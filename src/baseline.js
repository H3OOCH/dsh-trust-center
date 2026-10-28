/**
 * Optional, explicit profile baseline storage.
 *
 * The file contains only server/tool identifiers, SHA-256 fingerprints, and
 * timestamps. It never contains descriptions, schemas, annotations, Skill
 * bodies, or tool output. Scanning only reads; writing happens only when the
 * user explicitly records or accepts a baseline.
 */

import {
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

export const BASELINE_SCHEMA_VERSION = 1
export const MAX_BASELINE_BYTES = 256 * 1024
export const MAX_BASELINE_TOOLS = 500

/**
 * Resolve the profile-scoped baseline path. Persistence is disabled when DSH
 * does not expose a profile directory; guessing a shared path would be worse.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string|undefined}
 */
export function resolveBaselinePath(env = process.env) {
  const profileDir = typeof env.DSH_PROFILE_DIR === 'string' ? env.DSH_PROFILE_DIR.trim() : ''
  if (profileDir === '') return undefined
  return join(profileDir, 'trust-center', 'baseline.json')
}

/**
 * Create a profile baseline store. The store is synchronous because the scan
 * path is synchronous after the asynchronous tools snapshot is obtained.
 * @param {{file?: string, profile?: string, env?: NodeJS.ProcessEnv}} [options]
 * @returns {{
 *   filePath: string,
 *   profile: string,
 *   read: () => {status: 'ok'|'missing'|'invalid', data?: Record<string, any>, error?: string},
 *   write: (fingerprints: Array<Record<string, any>>, options?: {now?: number}) => Record<string, any>,
 * }|undefined}
 */
export function createBaselineStore({ file, profile, env = process.env } = {}) {
  const filePath = file ?? resolveBaselinePath(env)
  if (filePath === undefined) return undefined
  const profileName = profile ?? (typeof env.DSH_PROFILE === 'string' && env.DSH_PROFILE.trim() !== '' ? env.DSH_PROFILE.trim() : 'unknown')

  function read() {
    try {
      const stat = lstatSync(filePath)
      if (stat.isSymbolicLink()) return { status: 'invalid', error: 'baseline path is a symbolic link' }
      if (!stat.isFile()) return { status: 'invalid', error: 'baseline path is not a regular file' }
      if (stat.size > MAX_BASELINE_BYTES) return { status: 'invalid', error: `baseline exceeds ${MAX_BASELINE_BYTES} bytes` }
      const parsed = JSON.parse(readFileSync(filePath, 'utf8'))
      return { status: 'ok', data: validateBaseline(parsed, profileName) }
    } catch (error) {
      if (error?.code === 'ENOENT') return { status: 'missing' }
      return { status: 'invalid', error: error instanceof Error ? error.message : String(error) }
    }
  }

  function write(fingerprints, { now = Date.now() } = {}) {
    const iso = new Date(now).toISOString()
    const existing = read()
    const firstSeen = new Map()
    if (existing.status === 'ok') {
      for (const tool of existing.data.tools) firstSeen.set(`${tool.server}\u0000${tool.name}`, tool.firstSeen)
    }
    const records = fingerprints.slice(0, MAX_BASELINE_TOOLS).map((fingerprint) => ({
      server: fingerprint.server,
      name: fingerprint.name,
      sha256: fingerprint.sha256,
      firstSeen: firstSeen.get(fingerprint.key) ?? iso,
    }))
    const data = {
      schemaVersion: BASELINE_SCHEMA_VERSION,
      product: 'dsh-trust-center',
      profile: profileName,
      createdAt: existing.status === 'ok' ? existing.data.createdAt : iso,
      updatedAt: iso,
      tools: records,
    }
    mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 })
    try {
      const stat = lstatSync(filePath)
      if (stat.isSymbolicLink()) throw new Error('baseline path is a symbolic link')
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    const temp = `${filePath}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
    try {
      const fd = openSync(temp, 'wx', 0o600)
      try {
        writeFileSync(fd, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
        fsyncSync(fd)
      } finally {
        closeSync(fd)
      }
      renameSync(temp, filePath)
    } catch (error) {
      try { rmSync(temp, { force: true }) } catch { /* best effort */ }
      throw error
    }
    return { filePath, profile: profileName, recorded: records.length, createdAt: data.createdAt, updatedAt: data.updatedAt }
  }

  return { filePath, profile: profileName, read, write }
}

function validateBaseline(value, profile) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('baseline must be an object')
  if (value.schemaVersion !== BASELINE_SCHEMA_VERSION) throw new Error('unsupported baseline schema version')
  if (!Array.isArray(value.tools)) throw new Error('baseline tools must be an array')
  if (value.tools.length > MAX_BASELINE_TOOLS) throw new Error('baseline has too many tools')
  const tools = []
  for (const item of value.tools) {
    if (item === null || typeof item !== 'object') throw new Error('baseline tool entry must be an object')
    if (typeof item.server !== 'string' || item.server.length === 0) throw new Error('baseline tool server is invalid')
    if (typeof item.name !== 'string' || item.name.length === 0) throw new Error('baseline tool name is invalid')
    if (typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(item.sha256)) throw new Error('baseline tool hash is invalid')
    tools.push({
      server: item.server,
      name: item.name,
      sha256: item.sha256,
      firstSeen: typeof item.firstSeen === 'string' ? item.firstSeen : '',
    })
  }
  return {
    schemaVersion: value.schemaVersion,
    product: typeof value.product === 'string' ? value.product : 'dsh-trust-center',
    profile: typeof value.profile === 'string' ? value.profile : profile,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : '',
    tools,
  }
}
