import assert from 'node:assert/strict'
import test from 'node:test'
import {
  STATUS_PATH,
  createStatusHandler,
  isLoopback,
} from '../src/status.js'

function response() {
  return {
    statusCode: 0,
    headers: undefined,
    body: '',
    writeHead(status, headers) {
      this.statusCode = status
      this.headers = headers
    },
    end(body) {
      this.body = body
    },
  }
}

function request({ method = 'GET', host = '127.0.0.1:3000', url = STATUS_PATH, remote = '127.0.0.1' } = {}) {
  return {
    method,
    headers: { host },
    url,
    socket: { remoteAddress: remote },
  }
}

test('status route is loopback-only and GET-only', async () => {
  assert.equal(isLoopback(request()), true)
  assert.equal(isLoopback(request({ remote: '10.0.0.2' })), false)
  assert.equal(isLoopback(request({ host: 'example.com' })), false)
  assert.equal(isLoopback(request({ host: '[::1]:3000', remote: '::1' })), true)

  const calls = []
  const handler = createStatusHandler(async (options) => {
    calls.push(options)
    return { ok: true }
  })

  let res = response()
  await handler(request(), res)
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).ok, true)
  assert.deepEqual(calls.at(-1), { refresh: false })

  res = response()
  await handler(request({ url: `${STATUS_PATH}?refresh=1` }), res)
  assert.deepEqual(calls.at(-1), { refresh: true })

  res = response()
  await handler(request({ method: 'POST' }), res)
  assert.equal(res.statusCode, 405)

  res = response()
  await handler(request({ host: 'evil.example' }), res)
  assert.equal(res.statusCode, 403)

  res = response()
  await handler(request({ remote: '192.168.1.9' }), res)
  assert.equal(res.statusCode, 403)
})

test('status handler reports failures as JSON', async () => {
  const handler = createStatusHandler(async () => {
    throw new Error('scan failed')
  })
  const res = response()
  await handler(request(), res)
  assert.equal(res.statusCode, 500)
  assert.match(JSON.parse(res.body).error, /scan failed/)
  assert.equal(res.headers['cache-control'], 'no-store')
  assert.equal(res.headers['x-content-type-options'], 'nosniff')
})
