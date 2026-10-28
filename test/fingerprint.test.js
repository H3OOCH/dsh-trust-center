import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canonicalize,
  createDriftTracker,
  fingerprintTool,
  fingerprintTools,
} from '../src/fingerprint.js'

function schema(description = 'Echo a query.', parameters = { type: 'object', properties: { query: { type: 'string' } } }) {
  return { name: 'mcp__demo__echo', description, parameters }
}

test('canonical JSON is stable across object key order', () => {
  const a = { z: 1, a: { y: true, b: [2, 1] } }
  const b = { a: { b: [2, 1], y: true }, z: 1 }
  assert.equal(canonicalize(a), canonicalize(b))
})

test('fingerprints are stable and ignore native tools', () => {
  const a = fingerprintTool(schema())
  const b = fingerprintTool({
    name: 'mcp__demo__echo',
    parameters: { properties: { query: { type: 'string' } }, type: 'object' },
    description: 'Echo a query.',
  })
  assert.ok(a)
  assert.equal(a.key, 'demo\u0000echo')
  assert.equal(a.sha256, b.sha256)
  assert.equal(fingerprintTool({ name: 'read', description: 'Native tool' }), undefined)
  assert.equal(fingerprintTools([schema(), { name: 'native' }]).length, 1)
  assert.notEqual(a.sha256, fingerprintTool(schema('Echo a query.', { type: 'object', additionalProperties: true })).sha256)
})

test('memory drift tracker detects baseline, change, removal, and addition', () => {
  const tracker = createDriftTracker()
  const first = fingerprintTool(schema())
  let drift = tracker.observe([first], 1_700_000_000_000)
  assert.equal(drift.status, 'baseline-created')
  assert.equal(drift.mode, 'memory')
  assert.equal(drift.checked, 1)

  drift = tracker.observe([first], 1_700_000_001_000)
  assert.equal(drift.status, 'unchanged')

  const changed = fingerprintTool(schema('Echo a query with a new instruction.'))
  drift = tracker.observe([changed], 1_700_000_002_000)
  assert.equal(drift.status, 'changed')
  assert.equal(drift.changed.length, 1)
  assert.equal(drift.changed[0].name, 'echo')
  assert.equal(drift.changed[0].previousSha256, first.sha256)

  drift = tracker.observe([], 1_700_000_003_000)
  assert.equal(drift.status, 'changed')
  assert.equal(drift.removed.length, 1)

  const added = { key: 'demo\u0000new', server: 'demo', name: 'new', sha256: 'abc' }
  drift = tracker.observe([added], 1_700_000_004_000)
  assert.equal(drift.status, 'changed')
  assert.equal(drift.added.length, 1)
  assert.equal(drift.checked, 1)
})
