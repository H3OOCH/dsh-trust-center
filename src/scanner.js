/**
 * Host-side data collection and report assembly.
 *
 * Only live, already-registered surfaces are read: MCP tool schemas from
 * `ctx.tools.schemas()` and Skills from the optional `ctx.skills` registry.
 * Full Skill bodies never leave the Host; the browser receives evidence
 * snippets only.
 */

import {
  MAX_FINDINGS,
  MAX_SCAN_CHARS,
  finalizeFindings,
  parseMcpToolName,
  scanMcpServer,
  scanMcpTool,
  scanSkill,
  summarizeFindings,
} from './heuristics.js'
import { displayPath, estimateTokens, truncate, utf8Bytes } from './util.js'

export const PRODUCT = 'dsh-trust-center'
export const REPORT_VERSION = 1
export const DEFAULT_SKILL_LIMIT = 80
export const DEFAULT_MCP_LIMIT = 250
export const DEFAULT_TIMEOUT_MS = 10_000

/** Static limits shown in the page and the agent report. */
export const LIMITATIONS = Object.freeze([
  {
    code: 'heuristics-only',
    zh: '启发式审计只能提示风险，不能证明安全，也不是运行时沙箱。',
    en: 'Heuristic review can surface risk but cannot prove safety and is not a runtime sandbox.',
  },
  {
    code: 'mcp-server-metadata',
    zh: 'MCP 服务器指令、传输和连接状态没有通过公开工具接口暴露；这里只审计已注册工具的描述与 Schema。',
    en: 'MCP server instructions, transports, and connection state are not exposed through the public tool interface; this audit covers registered tool descriptions and schemas only.',
  },
  {
    code: 'skill-scope',
    zh: 'Skills 会按已注册工作区扫描；未被工作区注册的项目目录不在结果中。',
    en: 'Skills are scanned for registered workspaces; project directories not registered as workspaces are not included.',
  },
  {
    code: 'no-blocking',
    zh: '本插件只读展示，不会自动禁用 MCP 服务器或 Skill。',
    en: 'This plugin is read-only and never disables an MCP server or Skill automatically.',
  },
])

/**
 * Collect and score the active MCP/Skill surfaces.
 *
 * @param {object} ctx - Host Cordis context.
 * @param {{now?: number, maxSkills?: number, maxMcpTools?: number, timeoutMs?: number}} [options]
 * @returns {Promise<Record<string, any>>}
 */
export async function scanHarness(ctx, {
  now = Date.now(),
  maxSkills = DEFAULT_SKILL_LIMIT,
  maxMcpTools = DEFAULT_MCP_LIMIT,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const started = now
  const warnings = []
  const findings = []

  const tools = safeGet(ctx, 'tools')
  let toolSchemas = []
  let toolsAvailable = false
  if (tools !== undefined && typeof tools.schemas === 'function') {
    try {
      const schemas = tools.schemas()
      if (Array.isArray(schemas)) {
        toolsAvailable = true
        toolSchemas = schemas
      } else {
        warnings.push(warn('tools-scan-failed', 'tools.schemas() did not return an array'))
      }
    } catch (error) {
      warnings.push(warn('tools-scan-failed', errorText(error)))
    }
  } else {
    warnings.push(warn('tools-service-unavailable', 'The tools service is not mounted; MCP tools were not scanned.'))
  }

  let mcpSchemas = toolSchemas.filter((schema) => parseMcpToolName(schema?.name) !== undefined)
  const truncatedMcp = mcpSchemas.length > maxMcpTools
  if (truncatedMcp) {
    warnings.push(warn('mcp-tools-truncated', `Scanned the first ${maxMcpTools} of ${mcpSchemas.length} MCP tools.`))
    mcpSchemas = mcpSchemas.slice(0, maxMcpTools)
  }

  const mcpResults = mcpSchemas.map((schema, index) => scanMcpTool(schema, index))
  const servers = new Map()
  for (const result of mcpResults) {
    findings.push(...result.findings)
    const serverName = result.tool.server
    let server = servers.get(serverName)
    if (server === undefined) {
      server = {
        name: serverName,
        tools: [],
        findings: 0,
        tokens: 0,
        bytes: 0,
        capabilities: new Set(),
      }
      servers.set(serverName, server)
    }
    server.tools.push(result.tool)
    server.findings += result.tool.findings
    server.tokens += result.tool.tokens
    server.bytes += result.tool.bytes
    for (const capability of result.tool.capabilities) server.capabilities.add(capability.id)
  }

  for (const server of servers.values()) {
    const serverFinding = scanMcpServer(server.name, server.tools.length, server.tokens)
    if (serverFinding !== undefined) {
      findings.push(serverFinding)
      server.findings += 1
    }
    server.tools.sort((a, b) => b.findings - a.findings || a.name.localeCompare(b.name))
    server.capabilities = [...server.capabilities].sort()
  }

  const skills = safeGet(ctx, 'skills')
  let skillsAvailable = false
  let skillCwds = [undefined]
  const skillMap = new Map()
  let skillFailures = 0
  let skillResults = []
  let skillTotal = 0
  if (skills !== undefined && typeof skills.list === 'function' && typeof skills.get === 'function') {
    skillsAvailable = true
    skillCwds = resolveSkillCwds(ctx)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('Trust Center skill scan timed out')), timeoutMs)
    timer.unref?.()
    try {
      for (const cwd of skillCwds) {
        try {
          const list = await skills.list({
            ...(cwd === undefined ? {} : { cwd }),
            signal: controller.signal,
          })
          if (!Array.isArray(list)) {
            warnings.push(warn('skills-list-failed', 'ctx.skills.list() did not return an array'))
            continue
          }
          for (const summary of list) {
            const key = `${summary.name}\u0000${summary.source ?? ''}\u0000${summary.path ?? ''}`
            if (!skillMap.has(key)) skillMap.set(key, { summary, cwd })
          }
        } catch (error) {
          warnings.push(warn('skills-list-failed', `${cwd ?? 'global'}: ${errorText(error)}`))
        }
      }
    } finally {
      clearTimeout(timer)
    }

    skillTotal = skillMap.size
    const truncatedSkills = skillTotal > maxSkills
    if (truncatedSkills) {
      warnings.push(warn('skills-truncated', `Scanned the first ${maxSkills} of ${skillTotal} Skills.`))
    }
    const selected = [...skillMap.values()].slice(0, maxSkills)
    const loaded = await mapLimit(selected, 4, async (entry) => {
      try {
        const definition = await skills.get(entry.summary.name, {
          ...(entry.cwd === undefined ? {} : { cwd: entry.cwd }),
        })
        return { summary: entry.summary, definition: definition ?? { ...entry.summary, content: '' } }
      } catch (error) {
        skillFailures += 1
        return { summary: entry.summary, definition: { ...entry.summary, content: '' }, error }
      }
    })
    if (skillFailures > 0) {
      warnings.push(warn('skills-load-failed', `${skillFailures} Skill body/bodies could not be loaded and were only checked by summary.`))
    }
    for (const item of loaded) {
      try {
        skillResults.push(scanSkill(item.summary, item.definition))
      } catch (error) {
        skillFailures += 1
        warnings.push(warn('skills-scan-failed', `${item.summary?.name ?? 'unknown'}: ${errorText(error)}`))
      }
    }
    for (const result of skillResults) findings.push(...result.findings)
  } else {
    warnings.push(warn('skills-service-unavailable', 'The skills service is not mounted; Skills were not scanned.'))
  }

  const finalized = finalizeFindings(findings, MAX_FINDINGS)
  const summary = summarizeFindings(finalized)
  const totalMcpTokens = [...servers.values()].reduce((sum, server) => sum + server.tokens, 0)
  const totalSkillTokens = skillResults.reduce((sum, result) => sum + result.skill.tokens, 0)
  for (const server of servers.values()) {
    server.findings = finalized.filter((finding) => finding.surface === 'mcp' && finding.server === server.name).length
  }

  return {
    schemaVersion: REPORT_VERSION,
    product: PRODUCT,
    generatedAt: new Date(now).toISOString(),
    scanMs: Math.max(0, Date.now() - started),
    summary: {
      ...summary,
      mcpServers: servers.size,
      mcpTools: mcpResults.length,
      skills: skillResults.length,
      contextTokens: totalMcpTokens + totalSkillTokens,
      findingsTruncated: finalized.length < findings.length,
    },
    coverage: {
      tools: {
        available: toolsAvailable,
        total: toolSchemas.length,
        mcp: mcpSchemas.length,
        truncated: truncatedMcp,
      },
      skills: {
        available: skillsAvailable,
        total: skillTotal,
        scanned: skillResults.length,
        truncated: skillTotal > maxSkills,
        cwd: skillCwds.length === 1 ? displayPath(skillCwds[0]) : undefined,
        workspaces: skillCwds
          .filter((cwd) => cwd !== undefined)
          .map((cwd) => displayPath(cwd)),
      },
    },
    mcp: {
      servers: [...servers.values()]
        .map((server) => ({
          name: server.name,
          tools: server.tools.length,
          findings: server.findings,
          tokens: server.tokens,
          bytes: server.bytes,
          capabilities: server.capabilities,
          items: server.tools.map((tool) => ({
            name: tool.name,
            rawName: tool.rawName,
            description: tool.description,
            bytes: tool.bytes,
            tokens: tool.tokens,
            capabilities: tool.capabilities,
            findings: tool.findings,
          })),
        }))
        .sort((a, b) => b.findings - a.findings || b.tools - a.tools || a.name.localeCompare(b.name)),
      tokens: totalMcpTokens,
    },
    skills: {
      items: skillResults
        .map((result) => ({
          ...result.skill,
          path: displayPath(result.skill.path),
          findings: finalized.filter((finding) => finding.surface === 'skill' && finding.skill === result.skill.name).length,
        }))
        .sort((a, b) => b.findings - a.findings || b.tokens - a.tokens || a.name.localeCompare(b.name)),
      tokens: totalSkillTokens,
    },
    findings: finalized,
    warnings,
    limitations: LIMITATIONS,
  }
}

/**
 * Human-readable Chinese report for the agent-facing tool.
 * @param {Record<string, any>} report
 * @returns {string}
 */
export function formatReportZh(report) {
  const s = report.summary
  const lines = [
    'DSH Trust Center · MCP / Skill 信任审计',
    `风险评分：${s.riskScore}/100（${s.grade}） · 高风险 ${s.high} · 中风险 ${s.medium} · 低风险 ${s.low}`,
    `覆盖：${s.mcpServers} 个 MCP 服务器 / ${s.mcpTools} 个工具；${s.skills} 个 Skill；约 ${s.contextTokens} 上下文 token。`,
    '',
  ]
  if (report.findings.length === 0) {
    lines.push('未发现需要处理的启发式信号。注意：这不等于“安全”，只表示当前规则没有命中。')
  } else {
    lines.push('需要关注：')
    for (const finding of report.findings.slice(0, 18)) {
      const where = finding.surface === 'mcp'
        ? `MCP ${finding.server}/${finding.tool}`
        : `Skill ${finding.skill}`
      const evidence = finding.evidence?.[0]
      lines.push(`- [${finding.severity.toUpperCase()}] ${where} · ${finding.titleZh}${evidence ? ` @${evidence.field}${evidence.line === undefined ? '' : `:${evidence.line}`}` : ''}`)
    }
    if (report.findings.length > 18) lines.push(`- …另有 ${report.findings.length - 18} 条，请在 Trust Center 面板查看。`)
  }
  lines.push('', '覆盖范围与限制：')
  for (const limitation of report.limitations) lines.push(`- ${limitation.zh}`)
  if (report.warnings.length > 0) {
    lines.push('', '扫描告警：')
    for (const warning of report.warnings) lines.push(`- ${warning.code}: ${warning.message}`)
  }
  const paths = report.skills.items.filter((item) => item.path).slice(0, 5)
  if (paths.length > 0) {
    lines.push('', 'Skills 来源（节选）：')
    for (const item of paths) lines.push(`- ${item.name}: ${item.source} · ${item.path}`)
  }
  return lines.join('\n')
}

function resolveScanCwd(ctx) {
  const workingDirectory = safeGet(ctx, 'workingDirectory')
  const value = workingDirectory?.defaultDirectory ?? workingDirectory?.defaultDir
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * Resolve the workspaces whose project Skills should be audited. Scanning the
 * Host's default working directory alone would only see the profile directory
 * in Web settings, so registered workspace paths are the useful scope.
 *
 * @param {object} ctx
 * @returns {Array<string|undefined>}
 */
function resolveSkillCwds(ctx) {
  const paths = []
  try {
    const registry = safeGet(ctx, 'workspaceRegistry')
    const workspaces = typeof registry?.list === 'function' ? registry.list() : []
    if (Array.isArray(workspaces)) {
      for (const workspace of workspaces) {
        if (typeof workspace?.path === 'string' && workspace.path.length > 0) {
          if (!paths.includes(workspace.path)) paths.push(workspace.path)
        }
        if (paths.length >= 20) break
      }
    }
  } catch {
    // Fall back to the default working directory below.
  }
  if (paths.length === 0) {
    const fallback = resolveScanCwd(ctx)
    // The profile directory is not a project workspace; do not present it as
    // one. Global/user Skills are still listed via the no-cwd request.
    if (fallback !== undefined && !/[\\/]profiles[\\/]/u.test(fallback)) paths.push(fallback)
  }
  return paths.length === 0 ? [undefined] : paths
}

export const __internal = Object.freeze({
  mapLimit,
  resolveScanCwd,
  resolveSkillCwds,
  errorText,
  truncate,
  estimateTokens,
  utf8Bytes,
  MAX_SCAN_CHARS,
})

function safeGet(ctx, name) {
  try {
    return typeof ctx?.get === 'function' ? ctx.get(name) : undefined
  } catch {
    return undefined
  }
}

function warn(code, message) {
  return { code, message }
}

function errorText(error) {
  return error instanceof Error ? error.message : String(error)
}

async function mapLimit(items, limit, mapper) {
  const size = Math.max(1, Math.floor(limit) || 1)
  const results = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (true) {
      const index = next
      next += 1
      if (index >= items.length) return
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}
