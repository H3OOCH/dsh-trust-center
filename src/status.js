/**
 * Read-only browser snapshot for the Trust Center panel.
 *
 * The route is loopback-only and GET-only. It contains bounded excerpts of
 * MCP/Skill text, so it is deliberately not exposed to the LAN or a remote
 * browser; the panel says so when the fetch is refused.
 */

import { scanHarness } from './scanner.js'

export const STATUS_PATH = '/plugins/dsh-trust-center/status'
const CACHE_TTL_MS = 15_000

let cache

/**
 * Build a fresh report.
 * @param {object} ctx
 * @param {{observe: Function}|undefined} [driftTracker]
 * @returns {Promise<Record<string, any>>}
 */
export async function buildStatus(ctx, driftTracker) {
  return scanHarness(ctx, { driftTracker })
}

/**
 * Return the latest snapshot or a refreshed one.
 * @param {object} ctx
 * @param {{refresh?: boolean, ttlMs?: number, now?: number, driftTracker?: {observe: Function}}} [options]
 * @returns {Promise<Record<string, any>>}
 */
export async function cachedStatus(ctx, { refresh = false, ttlMs = CACHE_TTL_MS, now = Date.now(), driftTracker } = {}) {
  if (!refresh && cache !== undefined && now - cache.at < ttlMs) return cache.value
  const value = await buildStatus(ctx, driftTracker)
  cache = { at: now, value }
  return value
}

/** Explicit invalidation, used by tests and future change hooks. */
export function invalidateStatus() {
  cache = undefined
}

/**
 * Mount the status route when the host has a web server.
 * @param {object} ctx - Host Cordis context.
 * @param {{observe: Function}|undefined} [driftTracker]
 * @returns {void}
 */
export function registerStatusRoute(ctx, driftTracker) {
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => {
      const dispose = webCtx.webServer.register({
        kind: 'exact',
        path: STATUS_PATH,
        handler: createStatusHandler((options) => cachedStatus(ctx, { ...options, driftTracker })),
      })
      return () => dispose()
    }, 'dsh-trust-center: status route')
  })
}

/**
 * Browser-facing handler. Exported for tests.
 * @param {() => Promise<Record<string, any>>} getStatus
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function createStatusHandler(getStatus) {
  return async function statusHandler(req, res) {
    if (!isLoopback(req)) {
      send(res, 403, { error: 'Trust Center is available only from the local machine.' })
      return
    }
    if (req?.method !== 'GET') {
      send(res, 405, { error: 'method not allowed' })
      return
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    const refresh = url.searchParams.get('refresh') === '1'
    try {
      const value = await getStatus({ refresh })
      send(res, 200, value)
    } catch (error) {
      send(res, 500, { error: error instanceof Error ? error.message : String(error) })
    }
  }
}

/**
 * Loopback check using both the Host header and the actual peer address. Host
 * alone is spoofable by DNS rebinding; the peer address is the stronger fence.
 * @param {import('node:http').IncomingMessage} req
 * @returns {boolean}
 */
export function isLoopback(req) {
  const hostname = hostnameOf(req?.headers?.host)
  if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) return false
  const remote = String(req?.socket?.remoteAddress ?? '')
  if (remote === '') return true
  return remote === '::1'
    || remote.startsWith('127.')
    || remote.startsWith('::ffff:127.')
}

function hostnameOf(hostHeader) {
  const text = String(hostHeader ?? '').trim().toLowerCase()
  if (text === '') return ''
  if (text.startsWith('[')) {
    const end = text.indexOf(']')
    return end > 0 ? text.slice(1, end) : ''
  }
  return text.split(':')[0]
}

function send(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

export const __internal = Object.freeze({ hostnameOf, isLoopback, send })
