import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createBaselineStore, MAX_BASELINE_BYTES, resolveBaselinePath } from '../src/baseline.js'
import { createDriftTracker } from '../src/fingerprint.js'

function fingerprint(name = 'echo', sha256 = 'a'.repeat(64)) {
  return { key: `demo\u0000${name}`, server: 'demo', name, sha256 }
}

test('baseline path is profile-scoped and disabled without DSH_PROFILE_DIR', () => {
  assert.equal(resolveBaselinePath({}), undefined)
  assert.match(
    resolveBaselinePath({ DSH_PROFILE_DIR: 'C:\\profiles\\desktop' }),
    /profiles[\\/]desktop[\\/]trust-center[\\/]baseline\.json$/u,
  )
})

test('baseline store writes hash-only metadata and preserves firstSeen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-trust-center-baseline-'))
  try {
    const file = join(dir, 'trust-center', 'baseline.json')
    const store = createBaselineStore({ file, profile: 'test' })
    assert.equal(store.read().status, 'missing')
    const result = store.write([fingerprint()], { now: 1_700_000_000_000 })
    assert.equal(result.recorded, 1)
    const read = store.read()
    assert.equal(read.status, 'ok')
    assert.equal(read.data.profile, 'test')
    assert.equal(read.data.tools[0].server, 'demo')
    assert.equal(read.data.tools[0].name, 'echo')
    assert.equal(read.data.tools[0].sha256, 'a'.repeat(64))
    const raw = readFileSync(file, 'utf8')
    assert.doesNotMatch(raw, /description|inputSchema|annotations|properties/u)

    store.write([fingerprint()], { now: 1_700_000_100_000 })
    const second = store.read()
    assert.equal(second.data.createdAt, read.data.createdAt)
    assert.equal(second.data.tools[0].firstSeen, read.data.tools[0].firstSeen)
    assert.notEqual(second.data.updatedAt, read.data.updatedAt)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('invalid, oversized, and symlinked baseline files are rejected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-trust-center-baseline-'))
  try {
    const file = join(dir, 'baseline.json')
    const store = createBaselineStore({ file, profile: 'test' })
    writeFileSync(file, 'not json', 'utf8')
    assert.equal(store.read().status, 'invalid')
    writeFileSync(file, 'x'.repeat(MAX_BASELINE_BYTES + 1), 'utf8')
    assert.equal(store.read().status, 'invalid')

    if (process.platform !== 'win32') {
      const link = join(dir, 'link.json')
      symlinkSync(file, link)
      assert.equal(createBaselineStore({ file: link, profile: 'test' }).read().status, 'invalid')
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a file-backed tracker reads an existing baseline without writing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-trust-center-baseline-'))
  try {
    const file = join(dir, 'baseline.json')
    const store = createBaselineStore({ file, profile: 'test' })
    const first = createDriftTracker({ store })
    const initial = first.observe([fingerprint()], 1_700_000_000_000)
    assert.equal(initial.mode, 'memory')
    assert.equal(initial.status, 'baseline-created')
    assert.equal(store.read().status, 'missing')

    const recorded = first.record([fingerprint()], 1_700_000_100_000)
    assert.equal(recorded.mode, 'file')
    assert.equal(recorded.recorded, 1)
    assert.equal(store.read().status, 'ok')

    const second = createDriftTracker({ store })
    const loaded = second.observe([fingerprint()], 1_700_000_200_000)
    assert.equal(loaded.mode, 'file')
    assert.equal(loaded.status, 'unchanged')

    const changed = second.observe([fingerprint('echo', 'b'.repeat(64))], 1_700_000_300_000)
    assert.equal(changed.status, 'changed')
    assert.equal(changed.changed.length, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
