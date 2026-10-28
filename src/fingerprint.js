/**
 * Stable MCP tool fingerprints and an in-memory drift tracker.
 *
 * A fingerprint is a hash of the observable tool surface (server + tool name,
 * description, and input schema). It contains no description or schema body,
 * and it never includes annotations: those are server-declared claims.
 *
 * The tracker in this version is intentionally memory-only. Persistence is a
 * separate, opt-in design (see docs/drift-baseline.md).
 */

import { createHash } from 'node:crypto'
import { parseMcpToolName } from './heuristics.js'

/**
 * Deterministic JSON encoding: object keys are sorted recursively, while array
 * order is preserved.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalize(value) {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
}

function digest(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/**
 * Fingerprint one registered MCP tool schema.
 * @param {Record<string, any>} schema
 * @returns {{key: string, server: string, name: string, sha256: string}|undefined}
 */
export function fingerprintTool(schema) {
  const fullName = String(schema?.name ?? '')
  if (!fullName.startsWith('mcp__')) return undefined
  const identity = parseMcpToolName(fullName)
  if (identity === undefined) return undefined
  const description = typeof schema?.description === 'string' ? schema.description : ''
  const parameters = schema?.parameters ?? {}
  const material = canonicalize({
    server: identity.server,
    name: identity.rawName,
    description,
    parameters,
  })
  return {
    key: `${identity.server}\u0000${identity.rawName}`,
    server: identity.server,
    name: identity.rawName,
    sha256: digest(material),
  }
}

/**
 * Fingerprint all MCP schemas. Native tools are ignored.
 * @param {Array<Record<string, any>>} schemas
 * @returns {Array<{key: string, server: string, name: string, sha256: string}>}
 */
export function fingerprintTools(schemas) {
  const output = []
  for (const schema of Array.isArray(schemas) ? schemas : []) {
    const fingerprint = fingerprintTool(schema)
    if (fingerprint !== undefined) output.push(fingerprint)
  }
  return output
}

/**
 * Memory-only baseline. First observation records the baseline; later
 * observations compare against it and then advance it.
 * @returns {{
 *   observe: (fingerprints: Array<Record<string, any>>, at?: number) => Record<string, any>,
 *   reset: () => void,
 *   mode: 'memory',
 * }}
 */
export function createDriftTracker() {
  let baseline
  let baselineAt

  return {
    mode: 'memory',
    observe(fingerprints, at = Date.now()) {
      const current = new Map(fingerprints.map((fingerprint) => [fingerprint.key, fingerprint]))
      const observedAt = new Date(at).toISOString()
      if (baseline === undefined) {
        baseline = current
        baselineAt = observedAt
        return {
          mode: 'memory',
          status: 'baseline-created',
          baselineAt,
          checked: current.size,
          changed: [],
          added: [],
          removed: [],
        }
      }

      const changed = []
      const added = []
      const removed = []
      for (const [key, fingerprint] of current) {
        const previous = baseline.get(key)
        if (previous === undefined) {
          added.push({ server: fingerprint.server, name: fingerprint.name, sha256: fingerprint.sha256 })
        } else if (previous.sha256 !== fingerprint.sha256) {
          changed.push({
            server: fingerprint.server,
            name: fingerprint.name,
            sha256: fingerprint.sha256,
            previousSha256: previous.sha256,
          })
        }
      }
      for (const [key, previous] of baseline) {
        if (!current.has(key)) {
          removed.push({ server: previous.server, name: previous.name, previousSha256: previous.sha256 })
        }
      }
      // Keep the first baseline for the lifetime of this process. A changed
      // surface should stay visible on every refresh; accepting a new baseline
      // is a future, explicit action (not part of the in-memory version).
      return {
        mode: 'memory',
        status: changed.length > 0 || added.length > 0 || removed.length > 0 ? 'changed' : 'unchanged',
        baselineAt,
        checked: current.size,
        changed,
        added,
        removed,
      }
    },
    reset() {
      baseline = undefined
      baselineAt = undefined
    },
  }
}
