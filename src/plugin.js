/**
 * DSH Trust Center — Host half.
 *
 * Registers:
 * - a loopback-only read-only snapshot route for the Web panel;
 * - an optional `trust_scan` agent tool when `tools` is mounted.
 *
 * No hard service injections are declared, so a composition without a web
 * server or tool registry still loads the plugin harmlessly.
 */

import { formatReportZh, scanHarness } from './scanner.js'
import { createDriftTracker } from './fingerprint.js'
import { registerStatusRoute, invalidateStatus } from './status.js'

export const name = 'trust-center'
export const inject = []

export function apply(ctx) {
  const driftTracker = createDriftTracker()
  try {
    registerStatusRoute(ctx, driftTracker)
    ctx.on?.('tools/change', () => invalidateStatus())
    ctx.on?.('skills/change', () => invalidateStatus())
  } catch (error) {
    safeLog(ctx, 'warn', `[dsh-trust-center] Web snapshot unavailable: ${messageOf(error)}`)
  }

  try {
    ctx.inject?.(['tools'], (toolsCtx) => {
      registerTool(toolsCtx, driftTracker)
    })
  } catch (error) {
    safeLog(ctx, 'warn', `[dsh-trust-center] agent tool unavailable: ${messageOf(error)}`)
  }

  safeLog(ctx, 'info', '[dsh-trust-center] active: MCP tools + Skills trust audit')
  return undefined
}

function registerTool(ctx, driftTracker) {
  if (typeof ctx.tools?.register !== 'function') return
  try {
    ctx.tools.register({
      name: 'trust_scan',
      description: 'Audit the MCP tools and Skills that are currently visible to this agent for trust signals: prompt-injection language, hidden Unicode or HTML comments, dangerous command/credential patterns, oversized schemas or Skill bodies, and approximate context cost. Read-only; it never disables or edits a source. Use when the user asks to audit MCP servers, tool descriptions, Skills, prompt injection, hidden instructions, or context bloat.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          format: {
            type: 'string',
            enum: ['markdown', 'json'],
            description: 'Return a Chinese Markdown summary or the complete structured report.',
          },
        },
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args = {}) {
        const report = await scanHarness(ctx, { driftTracker })
        return args.format === 'json' ? JSON.stringify(report, null, 2) : formatReportZh(report)
      },
    })
  } catch (error) {
    safeLog(ctx, 'warn', `[dsh-trust-center] trust_scan registration degraded: ${messageOf(error)}`)
  }
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error)
}

function safeLog(ctx, level, message) {
  try {
    const logger = ctx?.logger
    const fn = typeof logger?.[level] === 'function' ? logger[level] : logger?.info
    if (typeof fn === 'function') fn.call(logger, message)
  } catch {
    // best effort only
  }
}
