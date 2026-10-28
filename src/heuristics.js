/**
 * Explainable, dependency-free heuristics for MCP tool descriptions/schemas and
 * Skill bodies.
 *
 * This is a review aid, not a sandbox or a proof of safety. Every finding keeps
 * its field, line (when available), offset, and a bounded visible excerpt.
 */

import {
  clamp,
  compareFindings,
  estimateTokens,
  evidenceSnippet,
  lineAt,
  shortHash,
  truncate,
  utf8Bytes,
} from './util.js'

export const MAX_FINDINGS = 200
export const MAX_SCAN_CHARS = 120_000
export const OVERSIZED_DESCRIPTION = 4_000
export const OVERSIZED_SCHEMA = 24_000
export const OVERSIZED_SKILL = 30_000

const SEVERITY_RANK = { high: 0, medium: 1, low: 2, info: 3 }

const RULE_COPY = Object.freeze({
  'prompt-injection-override': {
    category: 'prompt-injection',
    severity: 'high',
    zh: {
      title: '试图覆盖既有指令',
      detail: '这段外部文本包含要求模型忽略先前指令或改写系统/开发者规则的语句。',
      recommendation: '核对该 MCP 服务器或 Skill 的来源；若不是你明确需要的指令，移除或禁用该来源。',
    },
    en: {
      title: 'Attempts to override existing instructions',
      detail: 'This external text tells the model to ignore earlier instructions or rewrite system/developer rules.',
      recommendation: 'Verify the MCP server or Skill source; remove or disable it unless the instruction is explicitly intended.',
    },
  },
  'prompt-injection-exfiltration': {
    category: 'prompt-injection',
    severity: 'high',
    zh: {
      title: '疑似凭据外发指令',
      detail: '文本要求读取或发送密钥、令牌、密码、凭据等内容到外部位置。',
      recommendation: '不要调用该工具或加载该 Skill；在隔离环境中检查其来源和网络目标。',
    },
    en: {
      title: 'Possible credential exfiltration',
      detail: 'The text asks the model to read or send keys, tokens, passwords, or credentials to an external destination.',
      recommendation: 'Do not use the tool or Skill until its source and network destination are reviewed in isolation.',
    },
  },
  'prompt-injection-concealment': {
    category: 'prompt-injection',
    severity: 'high',
    zh: {
      title: '要求对用户隐瞒行为',
      detail: '文本要求模型不要告诉用户，或在用户不知情的情况下执行操作。',
      recommendation: '这是典型的工具投毒信号；禁用该来源，并检查同一服务器的其他工具。',
    },
    en: {
      title: 'Asks the model to hide behavior',
      detail: 'The text asks the model not to tell the user or to act without the user knowing.',
      recommendation: 'This is a classic tool-poisoning signal; disable the source and inspect sibling tools.',
    },
  },
  'prompt-injection-role': {
    category: 'prompt-injection',
    severity: 'medium',
    zh: {
      title: '注入系统/开发者身份描述',
      detail: '外部工具或 Skill 文本中出现了系统提示词、开发者消息等身份相关语句。',
      recommendation: '确认这是否只是文档说明；MCP 工具描述不应伪装成系统或开发者指令。',
    },
    en: {
      title: 'Injected system/developer identity language',
      detail: 'The external text mentions system prompts, developer messages, or claims a new model identity.',
      recommendation: 'Check whether it is explanatory prose; MCP descriptions should not masquerade as system/developer instructions.',
    },
  },
  'hidden-unicode': {
    category: 'hidden-content',
    severity: 'medium',
    zh: {
      title: '包含不可见 Unicode 字符',
      detail: '文本含有双向控制符、零宽字符、标签字符或其他不可见格式字符，可能隐藏真实指令。',
      recommendation: '在原始来源中删除这些字符，或只接受可审计的纯文本版本。',
    },
    en: {
      title: 'Contains invisible Unicode characters',
      detail: 'The text contains bidi controls, zero-width or tag characters, or other invisible formatting that can hide instructions.',
      recommendation: 'Remove these characters at the source, or only accept an auditable plain-text version.',
    },
  },
  'hidden-html-comment': {
    category: 'hidden-content',
    severity: 'medium',
    zh: {
      title: '包含隐藏的 HTML 注释',
      detail: '注释内容不会正常显示，但可能仍被模型读取。',
      recommendation: '检查注释中是否含有指令或凭据；不需要的注释应删除。',
    },
    en: {
      title: 'Contains hidden HTML comments',
      detail: 'Comment content is not normally visible to readers but may still be read by the model.',
      recommendation: 'Inspect the comment for instructions or secrets, and remove comments that are not needed.',
    },
  },
  'encoded-instructions': {
    category: 'hidden-content',
    severity: 'medium',
    zh: {
      title: '可能出现编码后的隐藏指令',
      detail: '发现长编码片段，附近还出现了解码或执行相关词汇。',
      recommendation: '解码后人工检查内容；不要执行未审查的编码载荷。',
    },
    en: {
      title: 'Possible encoded hidden instructions',
      detail: 'A long encoded blob appears near decode/execute language.',
      recommendation: 'Decode it for review; never execute an unreviewed encoded payload.',
    },
  },
  'dangerous-command': {
    category: 'dangerous-capability',
    severity: 'high',
    zh: {
      title: '包含高风险命令模式',
      detail: 'Skill 正文包含破坏性、远程执行或提权类命令示例。',
      recommendation: '确认这是必要的教学/自动化内容；在运行前逐条审查命令和影响范围。',
    },
    en: {
      title: 'Contains high-risk command patterns',
      detail: 'The Skill body contains destructive, remote-execution, or privilege-changing command examples.',
      recommendation: 'Confirm the examples are necessary; review every command and its blast radius before running it.',
    },
  },
  'credential-access': {
    category: 'dangerous-capability',
    severity: 'medium',
    zh: {
      title: '涉及凭据或敏感路径访问',
      detail: '文本提及读取、上传或处理密钥、令牌、密码、.env、.ssh 等敏感对象。',
      recommendation: '验证该 Skill/工具是否确实需要该权限；考虑移除凭据访问或改用最小权限凭据。',
    },
    en: {
      title: 'Touches credentials or sensitive paths',
      detail: 'The text mentions reading, uploading, or handling keys, tokens, passwords, .env, .ssh, or similar sensitive objects.',
      recommendation: 'Verify the Skill/tool actually needs this access; remove it or use a least-privilege credential.',
    },
  },
  'oversized-surface': {
    category: 'context-bloat',
    severity: 'medium',
    zh: {
      title: '内容过大，挤占上下文',
      detail: '这段描述、Schema 或 Skill 正文很大，会成为每轮请求的固定上下文成本。',
      recommendation: '精简描述/Schema，或把 Skill 拆成按需加载的多个小 Skill。',
    },
    en: {
      title: 'Oversized content consumes context',
      detail: 'This description, schema, or Skill body is large and becomes a recurring per-request context cost.',
      recommendation: 'Trim the description/schema or split the Skill into smaller on-demand Skills.',
    },
  },
  'broad-schema': {
    category: 'schema-hygiene',
    severity: 'low',
    zh: {
      title: 'Schema 过于宽松',
      detail: '参数允许任意附加字段或缺少结构约束，接收端需要额外校验。',
      recommendation: '在服务器端收紧 Schema 和输入校验，不要依赖模型自行遵守约束。',
    },
    en: {
      title: 'Overly permissive schema',
      detail: 'The parameters allow arbitrary additional fields or lack structural constraints; the server must validate independently.',
      recommendation: 'Tighten the schema and server-side validation; do not rely on the model to respect the shape.',
    },
  },
  'missing-description': {
    category: 'schema-hygiene',
    severity: 'low',
    zh: {
      title: '工具缺少说明',
      detail: '工具没有描述，模型只能从名称猜测用途，容易误用。',
      recommendation: '让 MCP 服务器补充清晰的工具描述和参数说明。',
    },
    en: {
      title: 'Tool has no description',
      detail: 'The model must guess the purpose from the name, which invites misuse.',
      recommendation: 'Add a clear tool and parameter description on the MCP server.',
    },
  },
  'many-tools': {
    category: 'context-bloat',
    severity: 'low',
    zh: {
      title: '单个 MCP 服务器工具过多',
      detail: '一个服务器注册了大量工具，会持续放大工具 schema 的上下文成本。',
      recommendation: '只启用当前任务需要的工具，或把服务器拆分成更小的 capability group。',
    },
    en: {
      title: 'MCP server exposes many tools',
      detail: 'A single server registers a large tool set, permanently growing the tool-schema context cost.',
      recommendation: 'Enable only the tools this task needs, or split the server into smaller capability groups.',
    },
  },
  'tool-fingerprint-changed': {
    category: 'drift',
    severity: 'medium',
    zh: {
      title: '工具指纹与内存基线不一致',
      detail: '该 MCP 工具的名称、描述或 Schema 与本次 Host 启动后首次观察到的内容不同。服务器可能在审查后改变 tools/list 响应。',
      recommendation: '对比当前描述/Schema 与上次审查版本；确认变化合理后再继续使用该工具。此基线只在当前 Host 进程内有效。',
    },
    en: {
      title: 'Tool fingerprint differs from the in-memory baseline',
      detail: 'The tool name, description, or schema differs from the first observation in this Host process. A server may return a different tools/list response after review.',
      recommendation: 'Compare the current description/schema with the reviewed version; only continue if the change is expected. This baseline lasts for the current Host process only.',
    },
  },
  'tool-fingerprint-new': {
    category: 'drift',
    severity: 'low',
    zh: {
      title: '发现基线中没有的工具',
      detail: '该 MCP 工具在本次 Host 会话首次扫描后出现，尚未经过审查。',
      recommendation: '检查新工具的来源、描述和 Schema；确认是否需要启用。此基线只在当前 Host 进程内有效。',
    },
    en: {
      title: 'Tool appeared after the in-memory baseline',
      detail: 'This MCP tool appeared after the first scan in this Host session and has not been reviewed.',
      recommendation: 'Review the new tool source, description, and schema before enabling it. This baseline lasts for the current Host process only.',
    },
  },
  'tool-fingerprint-removed': {
    category: 'drift',
    severity: 'low',
    zh: {
      title: '基线中的工具已消失',
      detail: '之前观察到的 MCP 工具在本次扫描中不存在。确认这是预期的服务器变更，而不是连接或配置问题。',
      recommendation: '检查服务器连接和配置；如果工具被移除是预期行为，可以忽略此提示。',
    },
    en: {
      title: 'Tool from the baseline disappeared',
      detail: 'An MCP tool observed earlier is absent from this scan. Confirm this is an intended server change, not a connection or configuration problem.',
      recommendation: 'Check the server connection and configuration; ignore this if the removal is expected.',
    },
  },
})

const PROMPT_PATTERNS = Object.freeze([
  {
    rule: 'prompt-injection-override',
    regex: /\b(?:ignore|disregard|forget|override|bypass)\b[\s\S]{0,50}\b(?:previous|prior|above|earlier|system|developer)\b[\s\S]{0,30}\b(?:instructions?|rules?|prompts?|messages?)\b/gi,
  },
  {
    rule: 'prompt-injection-override',
    regex: /(?:忽略|无视|忘记|覆盖|绕过)[\s\S]{0,30}(?:之前|以前|上面|上述|前面|系统|开发者)[\s\S]{0,20}(?:指令|指示|规则|要求|提示词|消息)/gu,
  },
  {
    rule: 'prompt-injection-exfiltration',
    regex: /\b(?:send|upload|post|transmit|exfiltrate|leak)\b[\s\S]{0,80}\b(?:api[\s_-]?key|token|password|secret|credential|\.env|\.ssh|ssh\s+key)\b/gi,
  },
  {
    rule: 'prompt-injection-exfiltration',
    regex: /(?:发送|上传|提交|传输|外发|泄露)[\s\S]{0,40}(?:密钥|令牌|密码|凭据|\.env|\.ssh|api\s*key|token)/giu,
  },
  {
    rule: 'prompt-injection-concealment',
    regex: /\b(?:do\s+not|don't|never)\s+(?:tell|inform|notify|mention\s+[^.]{0,30}\s+to)\s+(?:the\s+)?user\b|\bwithout\s+(?:telling|informing|notifying)\s+(?:the\s+)?user\b/gi,
  },
  {
    rule: 'prompt-injection-concealment',
    regex: /(?:不要|不得|别)(?:告诉|告知|通知|提醒)(?:用户|人类)|(?:在)?用户(?:不知情|不知道)的情况下|秘密(?:地)?(?:执行|上传|发送|读取)/gu,
  },
  {
    rule: 'prompt-injection-role',
    regex: /\b(?:system|developer)\s+(?:prompt|message|instructions?)\b|\byou\s+are\s+now\b|\bnew\s+instructions?\s*:/gi,
  },
  {
    rule: 'prompt-injection-role',
    regex: /(?:系统提示词|开发者消息|系统消息|你现在是|新的指令\s*[:：])/gu,
  },
])

const COMMAND_PATTERNS = Object.freeze([
  { regex: /\brm\s+-rf\s+(?:[/~]|[A-Za-z]:\\)/gi, high: true },
  { regex: /\b(?:curl|wget)\b[^\n|]{0,160}\|\s*(?:bash|sh|zsh|powershell|pwsh)\b/gi, high: true },
  { regex: /\b(?:Invoke-Expression|IEX)\b|\bpowershell(?:\.exe)?\b[^\n]{0,80}\s-(?:enc|encodedcommand)\b/gi, high: true },
  { regex: /\b(?:format\s+[a-z]:|shutdown\s+\/[a-z]|reg\s+delete)\b/gi, high: true },
  { regex: /\bchmod\s+777\b|\bgit\s+push\s+--force\b/gi, high: false },
])

const CREDENTIAL_PATTERNS = Object.freeze([
  /(?:^|[\\/\s'"`])(?:\.env|\.ssh|id_rsa|id_ed25519|credentials|auth\.json)(?:$|[\\/\s'"`])/gi,
  /\b(?:api[\s_-]?key|access[\s_-]?token|refresh[\s_-]?token|client[\s_-]?secret|password|passwd)\b/gi,
  /(?:密钥|令牌|密码|凭据|私钥)/gu,
])

const CREDENTIAL_ACCESS_VERB = /\b(?:read|open|cat|load|send|upload|post|transmit|curl|wget|fetch|request|export|leak|exfiltrate)\b|读取|打开|发送|上传|导出|外发/iu
const SENSITIVE_PATH = /(?:^|[\\/\s'"`])(?:\.env|\.ssh|id_rsa|id_ed25519|auth\.json|credentials)(?:$|[\\/\s'"`])/iu

const CAPABILITY_PATTERNS = Object.freeze([
  { id: 'shell', label: 'Shell / exec', regex: /\b(?:shell|bash|terminal|powershell|pwsh|subprocess|exec|execute|command)\b|命令|终端/giu },
  { id: 'filesystem-write', label: 'Filesystem write', regex: /\b(?:write|edit|create|delete|remove|move|rename|truncate)\b|写入|编辑|删除|移动/giu },
  { id: 'network', label: 'Network', regex: /\b(?:http|https|fetch|request|upload|download|webhook|socket|url)\b|上传|下载|网络/giu },
  { id: 'credentials', label: 'Credentials', regex: /\b(?:credential|secret|password|token|api[_-]?key|ssh)\b|凭据|密钥|令牌|密码/giu },
  { id: 'database', label: 'Database', regex: /\b(?:database|sql|query|insert|update|drop|table)\b|数据库/giu },
  { id: 'browser', label: 'Browser', regex: /\b(?:browser|click|screenshot|dom|chromium|playwright)\b|浏览器/giu },
])

const MAX_CAPABILITY_IDS = 6

/**
 * Parse the official MCP tool namespace. Native tools are ignored by callers.
 * @param {string} name
 * @returns {{server: string, rawName: string}|undefined}
 */
export function parseMcpToolName(name) {
  const value = String(name ?? '')
  if (!value.startsWith('mcp__')) return undefined
  const rest = value.slice(5)
  const separator = rest.indexOf('__')
  if (separator <= 0) return { server: rest, rawName: rest }
  return { server: rest.slice(0, separator), rawName: rest.slice(separator + 2) }
}

/**
 * Detect capability categories from a tool name and description.
 * These are product metadata, not findings.
 * @param {string} name
 * @param {string} description
 * @returns {Array<{id: string, label: string}>}
 */
export function detectCapabilities(name, description) {
  const text = `${name ?? ''}\n${description ?? ''}`
  const found = []
  for (const capability of CAPABILITY_PATTERNS) {
    capability.regex.lastIndex = 0
    if (capability.regex.test(text)) found.push({ id: capability.id, label: capability.label })
  }
  return found.slice(0, MAX_CAPABILITY_IDS)
}

/**
 * Scan one text field for prompt-injection and hidden-content signals.
 * @param {{
 *   text: string,
 *   surface: 'mcp'|'skill',
 *   subject: string,
 *   subjectType: string,
 *   field: string,
 *   lineBase?: number,
 *   server?: string,
 *   tool?: string,
 *   skill?: string,
 *   scanCommands?: boolean,
 *   scanCredentials?: boolean,
 *   allowance?: number,
 * }} input
 * @returns {Array<Record<string, any>>}
 */
export function scanField(input) {
  const {
    text,
    surface,
    subject,
    subjectType,
    field,
    server,
    tool,
    skill,
    scanCommands = false,
    scanCredentials = false,
  } = input
  const source = String(text ?? '')
  if (source.length === 0) return []
  const findings = []
  for (const pattern of PROMPT_PATTERNS) {
    const evidence = []
    pattern.regex.lastIndex = 0
    let match
    while ((match = pattern.regex.exec(source)) !== null && evidence.length < 2) {
      evidence.push(evidenceAt(source, match.index, field, input.lineBase))
      if (match[0].length === 0) pattern.regex.lastIndex += 1
    }
    if (evidence.length > 0) {
      findings.push(makeFinding({
        surface, subject, subjectType, server, tool, skill, rule: pattern.rule, field, evidence,
      }))
    }
  }

  const hidden = findHiddenCharacters(source)
  if (hidden.length > 0) {
    const severity = hidden.some((item) => item.severity === 'high')
      ? 'high'
      : hidden.some((item) => item.severity === 'medium') ? 'medium' : 'low'
    findings.push(makeFinding({
      surface, subject, subjectType, server, tool, skill, rule: 'hidden-unicode', field,
      severity,
      evidence: hidden.slice(0, 3).map((item) => ({
        field,
        offset: item.offset,
        line: input.lineBase === undefined ? undefined : input.lineBase + (lineAt(source, item.offset) ?? 1) - 1,
        snippet: `${item.label} at offset ${item.offset}: ${evidenceSnippet(source, item.offset, 42)}`,
        codepoint: item.codePoint,
      })),
    }))
  }

  const commentEvidence = []
  const commentPattern = /<!--([\s\S]*?)-->/g
  let comment
  while ((comment = commentPattern.exec(source)) !== null && commentEvidence.length < 2) {
    const inner = comment[1] ?? ''
    if (inner.trim().length === 0) continue
    commentEvidence.push(evidenceAt(source, comment.index, field, input.lineBase))
  }
  if (commentEvidence.length > 0) {
    findings.push(makeFinding({
      surface, subject, subjectType, server, tool, skill, rule: 'hidden-html-comment', field,
      severity: containsInstruction(commentEvidence.map((item) => item.snippet).join(' ')) ? 'high' : 'medium',
      evidence: commentEvidence,
    }))
  }

  const encoded = findEncodedPayload(source)
  if (encoded !== undefined) {
    findings.push(makeFinding({
      surface, subject, subjectType, server, tool, skill, rule: 'encoded-instructions', field,
      evidence: [evidenceAt(source, encoded, field, input.lineBase)],
    }))
  }

  if (scanCommands) {
    const commandEvidence = []
    let high = false
    for (const pattern of COMMAND_PATTERNS) {
      pattern.regex.lastIndex = 0
      let match
      while ((match = pattern.regex.exec(source)) !== null && commandEvidence.length < 3) {
        high ||= pattern.high
        commandEvidence.push(evidenceAt(source, match.index, field, input.lineBase))
        if (match[0].length === 0) pattern.regex.lastIndex += 1
      }
    }
    if (commandEvidence.length > 0) {
      findings.push(makeFinding({
        surface, subject, subjectType, server, tool, skill, rule: 'dangerous-command', field,
        severity: high ? 'high' : 'medium',
        evidence: commandEvidence,
      }))
    }
  }

  if (scanCredentials && containsCredentialAccess(source)) {
    const at = firstCredentialIndex(source)
    findings.push(makeFinding({
      surface, subject, subjectType, server, tool, skill, rule: 'credential-access', field,
      severity: SENSITIVE_PATH.test(source) ? 'high' : 'medium',
      evidence: [evidenceAt(source, Math.max(0, at), field, input.lineBase)],
    }))
  }

  return findings
}

/**
 * Scan one MCP tool schema.
 * @param {Record<string, any>} schema - ToolSchema from ctx.tools.schemas().
 * @param {number} [index]
 * @returns {{tool: Record<string, any>, findings: Array<Record<string, any>>}}
 */
export function scanMcpTool(schema, index = 0) {
  const name = String(schema?.name ?? '')
  const identity = parseMcpToolName(name) ?? { server: 'unknown', rawName: name }
  const description = typeof schema?.description === 'string' ? schema.description : ''
  const parameters = schema?.parameters ?? {}
  const parameterText = safeStringify(parameters)
  const bytes = utf8Bytes(parameterText) + utf8Bytes(description)
  const tokens = estimateTokens(description) + estimateTokens(parameterText)
  const subject = `mcp:${identity.server}:${identity.rawName}`
  const subjectType = 'mcp-tool'
  const base = {
    surface: 'mcp',
    subject,
    subjectType,
    server: identity.server,
    tool: identity.rawName,
  }
  const findings = [
    ...scanField({
      ...base,
      text: description,
      field: 'description',
    }),
    ...scanSchemaStrings(parameters, base),
  ]

  if (description.length > OVERSIZED_DESCRIPTION) {
    findings.push(makeFinding({
      ...base,
      rule: 'oversized-surface',
      field: 'description',
      severity: description.length > OVERSIZED_DESCRIPTION * 3 ? 'high' : 'medium',
      metrics: { chars: description.length, tokens: estimateTokens(description) },
      evidence: [{
        field: 'description',
        offset: 0,
        snippet: truncate(description, 200),
      }],
    }))
  }
  if (parameterText.length > OVERSIZED_SCHEMA) {
    findings.push(makeFinding({
      ...base,
      rule: 'oversized-surface',
      field: 'parameters',
      severity: parameterText.length > OVERSIZED_SCHEMA * 3 ? 'high' : 'medium',
      metrics: { chars: parameterText.length, tokens: estimateTokens(parameterText) },
      evidence: [{
        field: 'parameters',
        offset: 0,
        snippet: truncate(parameterText, 200),
      }],
    }))
  }
  if (description.trim().length === 0) {
    findings.push(makeFinding({
      ...base,
      rule: 'missing-description',
      field: 'description',
      evidence: [],
    }))
  }
  if (isBroadSchema(parameters)) {
    findings.push(makeFinding({
      ...base,
      rule: 'broad-schema',
      field: 'parameters',
      evidence: [{
        field: 'parameters',
        offset: 0,
        snippet: truncate(parameterText, 200),
      }],
    }))
  }

  return {
    tool: {
      name,
      server: identity.server,
      rawName: identity.rawName,
      description: truncate(description, 240),
      bytes,
      tokens,
      capabilities: detectCapabilities(`${identity.rawName} ${description}`, parameterText),
      findings: findings.length,
      index,
    },
    findings,
  }
}

/**
 * Convert an in-memory drift result into review findings.
 * @param {{changed?: Array, added?: Array, removed?: Array, status?: string}|undefined} drift
 * @returns {Array<Record<string, any>>}
 */
export function driftFindings(drift) {
  if (drift === undefined || drift.status !== 'changed') return []
  const findings = []
  const emit = (item, rule) => {
    findings.push(makeFinding({
      surface: 'mcp',
      subject: `mcp:${item.server}:${item.name}`,
      subjectType: 'mcp-tool',
      server: item.server,
      tool: item.name,
      rule,
      field: 'tool',
    }))
  }
  for (const item of drift.changed ?? []) emit(item, 'tool-fingerprint-changed')
  for (const item of drift.added ?? []) emit(item, 'tool-fingerprint-new')
  for (const item of drift.removed ?? []) emit(item, 'tool-fingerprint-removed')
  return findings
}

/**
 * Scan one Skill summary plus its loaded body.
 * @param {Record<string, any>} summary - SkillSummary.
 * @param {Record<string, any>} definition - SkillDefinition (may equal summary with content).
 * @returns {{skill: Record<string, any>, findings: Array<Record<string, any>>}}
 */
export function scanSkill(summary, definition) {  const name = String(summary?.name ?? definition?.name ?? 'unknown-skill')
  const content = typeof definition?.content === 'string' ? definition.content : ''
  const description = String(summary?.description ?? '')
  const whenToUse = String(summary?.whenToUse ?? '')
  const body = content.length > MAX_SCAN_CHARS ? content.slice(0, MAX_SCAN_CHARS) : content
  const subject = `skill:${name}`
  const base = {
    surface: 'skill',
    subject,
    subjectType: 'skill',
    skill: name,
  }
  const findings = [
    ...scanField({ ...base, text: description, field: 'description' }),
    ...scanField({ ...base, text: whenToUse, field: 'whenToUse' }),
    ...scanField({
      ...base,
      text: body,
      field: 'content',
      scanCommands: true,
      scanCredentials: true,
    }),
  ]

  if (content.length > OVERSIZED_SKILL) {
    findings.push(makeFinding({
      ...base,
      rule: 'oversized-surface',
      field: 'content',
      severity: content.length > OVERSIZED_SKILL * 3 ? 'high' : 'medium',
      metrics: { chars: content.length, tokens: estimateTokens(content) },
      evidence: [{
        field: 'content',
        line: 1,
        offset: 0,
        snippet: truncate(content, 200),
      }],
    }))
  }

  return {
    skill: {
      name,
      description: truncate(description, 180),
      source: String(summary?.source ?? definition?.source ?? 'unknown'),
      provider: String(summary?.provider ?? definition?.provider ?? 'unknown'),
      path: summary?.path === undefined ? undefined : String(summary.path),
      invocation: summary?.invocation ?? definition?.invocation,
      chars: content.length,
      tokens: estimateTokens(content),
      findings: findings.length,
    },
    findings,
  }
}

/**
 * Server-level signal for a very large MCP tool surface.
 * @param {string} server
 * @param {number} toolCount
 * @param {number} tokens
 * @returns {Record<string, any>|undefined}
 */
export function scanMcpServer(server, toolCount, tokens) {
  if (toolCount < 40) return undefined
  return makeFinding({
    surface: 'mcp',
    subject: `mcp-server:${server}`,
    subjectType: 'mcp-server',
    server,
    rule: 'many-tools',
    field: 'server',
    severity: toolCount >= 80 ? 'medium' : 'low',
    metrics: { tools: toolCount, tokens },
    evidence: [{
      field: 'server',
      offset: 0,
      snippet: `${server}: ${toolCount} tools, ≈${tokens} tokens`,
    }],
  })
}

/**
 * Build the risk summary used by the page and reports.
 * @param {Array<Record<string, any>>} findings
 * @returns {{riskScore: number, grade: string, high: number, medium: number, low: number, info: number, total: number}}
 */
export function summarizeFindings(findings) {
  const counts = { high: 0, medium: 0, low: 0, info: 0 }
  for (const finding of findings) counts[finding.severity] = (counts[finding.severity] ?? 0) + 1
  const score = clamp(counts.high * 18 + counts.medium * 7 + counts.low * 2, 0, 100)
  const grade = score >= 60 ? 'D' : score >= 30 ? 'C' : score >= 10 ? 'B' : 'A'
  return {
    riskScore: score,
    grade,
    high: counts.high,
    medium: counts.medium,
    low: counts.low,
    info: counts.info,
    total: findings.length,
  }
}

/**
 * Deduplicate and order findings, enforcing a hard report bound.
 * @param {Array<Record<string, any>>} findings
 * @param {number} [limit]
 * @returns {Array<Record<string, any>>}
 */
export function finalizeFindings(findings, limit = MAX_FINDINGS) {
  const seen = new Set()
  const unique = []
  for (const finding of findings) {
    const key = `${finding.id}:${finding.field}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(finding)
    if (unique.length >= limit) break
  }
  return unique
    .map((finding) => ({ ...finding, severityRank: SEVERITY_RANK[finding.severity] ?? 9 }))
    .sort(compareFindings)
}

/**
 * Format a finding as one compact Chinese line for the model-facing tool.
 * @param {Record<string, any>} finding
 * @returns {string}
 */
export function formatFindingZh(finding) {
  const where = finding.surface === 'mcp'
    ? `MCP ${finding.server}/${finding.tool}`
    : `Skill ${finding.skill}`
  const first = finding.evidence?.[0]
  const evidence = first === undefined
    ? ''
    : ` @${finding.field}${first.line === undefined ? '' : `:${first.line}`} “${first.snippet}”`
  return `- [${finding.severity.toUpperCase()}] ${where}: ${finding.titleZh}${evidence}`
}

function scanSchemaStrings(parameters, base) {
  const findings = []
  const descriptions = collectSchemaFields(parameters, ['parameters'], 0, [])
  for (const item of descriptions.slice(0, 32)) {
    findings.push(...scanField({
      ...base,
      text: item.text,
      field: item.path,
    }))
  }
  return findings
}

function collectSchemaFields(value, path, depth, output) {
  if (depth > 10 || output.length >= 32) return output
  if (typeof value === 'string') {
    if (value.length >= 4 && value.length <= 8_000) {
      output.push({ path: path.join('.'), text: value })
    }
    return output
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < Math.min(value.length, 24); index += 1) {
      collectSchemaFields(value[index], [...path, String(index)], depth + 1, output)
    }
    return output
  }
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value).slice(0, 32)) {
      // Scan prose-bearing fields only, plus defaults and enums where hidden
      // payloads often live; arbitrary property names are not prose.
      const child = value[key]
      if (['description', 'title', 'summary', 'default', 'examples', 'example', 'pattern'].includes(key)
        || typeof child === 'string') {
        collectSchemaFields(child, [...path, key], depth + 1, output)
      } else {
        collectSchemaFields(child, [...path, key], depth + 1, output)
      }
    }
  }
  return output
}

function makeFinding({
  surface,
  subject,
  subjectType,
  server,
  tool,
  skill,
  rule,
  field,
  evidence = [],
  severity,
  metrics,
}) {
  const copy = RULE_COPY[rule] ?? RULE_COPY['missing-description']
  const chosenSeverity = severity ?? copy.severity
  return {
    id: `${surface}:${shortHash(subject)}:${rule}:${shortHash(field)}`,
    surface,
    subject,
    subjectType,
    ...(server === undefined ? {} : { server }),
    ...(tool === undefined ? {} : { tool }),
    ...(skill === undefined ? {} : { skill }),
    rule,
    category: copy.category,
    severity: chosenSeverity,
    confidence: chosenSeverity === 'low' ? 'low' : 'medium',
    field,
    titleZh: copy.zh.title,
    titleEn: copy.en.title,
    detailZh: copy.zh.detail,
    detailEn: copy.en.detail,
    recommendationZh: copy.zh.recommendation,
    recommendationEn: copy.en.recommendation,
    ...(metrics === undefined ? {} : { metrics }),
    evidence: evidence.slice(0, 3),
  }
}

function evidenceAt(text, index, field, lineBase) {
  const source = String(text ?? '')
  const line = lineAt(source, index)
  return {
    field,
    offset: index,
    line: lineBase === undefined || line === undefined ? line : lineBase + line - 1,
    snippet: evidenceSnippet(source, index),
  }
}

function findHiddenCharacters(text) {
  const source = String(text ?? '')
  const found = []
  let index = 0
  for (const character of source) {
    const codePoint = character.codePointAt(0)
    const classification = classifyInvisible(codePoint)
    if (classification !== undefined) {
      found.push({
        codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
        label: classification.label,
        severity: classification.severity,
        offset: index,
      })
    }
    index += character.length
  }
  return found
}

function classifyInvisible(codePoint) {
  if (codePoint >= 0x202A && codePoint <= 0x202E) return { label: 'bidi control', severity: 'high' }
  if (codePoint >= 0x2066 && codePoint <= 0x2069) return { label: 'bidi isolate', severity: 'high' }
  if (codePoint >= 0xE0000 && codePoint <= 0xE007F) return { label: 'tag character', severity: 'high' }
  if (codePoint === 0xFEFF) return { label: 'zero-width BOM', severity: 'medium' }
  // U+200C/U+200D are legitimate in Persian and emoji sequences; the
  // genuinely suspicious zero-width and bidi marks remain in scope.
  if (codePoint === 0x200B || codePoint === 0x200E || codePoint === 0x200F) {
    return { label: 'zero-width/bidi mark', severity: 'medium' }
  }
  if (codePoint >= 0x2060 && codePoint <= 0x2064) return { label: 'invisible formatting', severity: 'medium' }
  if ((codePoint >= 0x0000 && codePoint <= 0x0008)
    || (codePoint >= 0x000E && codePoint <= 0x001F)
    || (codePoint >= 0x007F && codePoint <= 0x009F)) {
    return { label: 'control character', severity: 'medium' }
  }
  return undefined
}

function findEncodedPayload(text) {
  const source = String(text ?? '')
  const pattern = /[A-Za-z0-9+/]{400,}={0,2}/g
  let match
  while ((match = pattern.exec(source)) !== null) {
    const around = source.slice(Math.max(0, match.index - 120), match.index + match[0].length + 120)
    if (/\b(?:base64|atob|decode|decrypt|execute|exec|eval|payload)\b/i.test(around)) return match.index
  }
  return undefined
}

function containsInstruction(text) {
  return /(?:ignore|disregard|system|developer|instruction|ignore\s+previous|不要告诉|忽略|系统提示|指令)/i.test(text)
}

function containsCredentialAccess(text) {
  const source = String(text ?? '')
  if (SENSITIVE_PATH.test(source)) return true
  return CREDENTIAL_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(source)) !== null) {
      const window = source.slice(Math.max(0, match.index - 100), match.index + match[0].length + 100)
      if (CREDENTIAL_ACCESS_VERB.test(window)) return true
      if (match[0].length === 0) pattern.lastIndex += 1
    }
    return false
  })
}

function firstCredentialIndex(text) {
  const source = String(text ?? '')
  let first = -1
  for (const pattern of CREDENTIAL_PATTERNS) {
    pattern.lastIndex = 0
    const match = pattern.exec(source)
    if (match !== null && (first === -1 || match.index < first)) first = match.index
  }
  return first
}

function isBroadSchema(parameters) {
  if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters)) return false
  if (parameters.type !== undefined && parameters.type !== 'object') return false
  if (parameters.$ref !== undefined || parameters.anyOf !== undefined || parameters.oneOf !== undefined || parameters.allOf !== undefined) {
    return false
  }
  const hasProperties = parameters.properties !== null
    && typeof parameters.properties === 'object'
    && !Array.isArray(parameters.properties)
    && Object.keys(parameters.properties).length > 0
  if (hasProperties) return false
  const keys = Object.keys(parameters)
  return parameters.additionalProperties === true || keys.length === 0
}

function safeStringify(value) {
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return String(value)
  }
}

export const __internal = Object.freeze({
  RULE_COPY,
  PROMPT_PATTERNS,
  COMMAND_PATTERNS,
  CREDENTIAL_PATTERNS,
  findHiddenCharacters,
  classifyInvisible,
  findEncodedPayload,
  collectSchemaFields,
  makeFinding,
})
