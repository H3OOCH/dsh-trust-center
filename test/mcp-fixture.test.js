import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { scanHarness } from '../src/scanner.js'

const fixtureUrl = new URL('./fixtures/mcp-tools-list.json', import.meta.url)

/** Convert a real MCP tools/list result into DSH tool schemas. */
async function loadFixtureSchemas() {
  const message = JSON.parse(await readFile(fixtureUrl, 'utf8'))
  assert.equal(message.jsonrpc, '2.0')
  assert.ok(Array.isArray(message.result?.tools))
  return message.result.tools.map((tool) => ({
    name: `mcp__fixture__${tool.name}`,
    description: tool.description,
    parameters: tool.inputSchema,
    annotations: tool.annotations,
  }))
}

test('MCP tools/list fixture exercises the full Host-side scan path', async () => {
  const schemas = await loadFixtureSchemas()
  const ctx = { get: (name) => name === 'tools' ? { schemas: () => schemas } : undefined }
  const report = await scanHarness(ctx, { now: 1_700_000_000_000 })

  assert.equal(report.summary.mcpServers, 1)
  assert.equal(report.summary.mcpTools, 4)
  assert.equal(report.coverage.tools.mcp, 4)
  assert.equal(report.mcp.servers[0].name, 'fixture')
  assert.equal(report.mcp.servers[0].tools, 4)

  const rules = new Set(report.findings.map((finding) => finding.rule))
  assert.ok(rules.has('prompt-injection-override'), 'prompt injection is detected')
  assert.ok(rules.has('hidden-unicode'), 'hidden Unicode is detected')
  assert.ok(rules.has('hidden-html-comment'), 'hidden HTML comments are detected')
  assert.ok(rules.has('broad-schema'), 'an unconstrained schema is treated as broad')
  assert.ok(rules.has('prompt-injection-concealment'), 'concealment is detected')

  const byName = new Map(report.mcp.servers[0].items.map((tool) => [tool.rawName, tool]))
  assert.ok(byName.get('run_shell').capabilities.some((capability) => capability.id === 'shell'))
  assert.ok(byName.get('write_file').capabilities.some((capability) => capability.id === 'filesystem-write'))
  assert.ok(!report.findings.some((finding) => finding.tool === 'benign_lookup'))

  // readOnlyHint is server-declared metadata; it must not suppress the write
  // capability or appear as independent evidence.
  assert.ok(report.limitations.some((limitation) => limitation.code === 'annotations-are-claims'))
  assert.ok(report.findings.every((finding) => finding.evidence.every((evidence) => !String(evidence.snippet).includes('readOnlyHint'))))
})
