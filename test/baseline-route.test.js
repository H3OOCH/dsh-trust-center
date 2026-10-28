import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import { BASELINE_PATH, createBaselineHandler } from '../src/status.js'

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

function request({
  method = 'POST',
  host = '127.0.0.1:3000',
  remote = '127.0.0.1',
  contentType = 'application/json',
  action = 'baseline',
  body = '{"action":"record"}',
} = {}) {
  const req = new EventEmitter()
  req.method = method
  req.url = BASELINE_PATH
  req.headers = {
    host,
    'content-type': contentType,
    ...(action === undefined ? {} : { 'x-trust-center-action': action }),
  }
  req.socket = { remoteAddress: remote }
  req.destroy = () => {}
  process.nextTick(() => {
    if (body !== undefined) req.emit('data', Buffer.from(body))
    req.emit('end')
  })
  return req
}

test('baseline handler writes only on an explicit loopback JSON action', async () => {
  const calls = []
  const handler = createBaselineHandler(async () => {
    calls.push('record')
    return { mode: 'file', recorded: 2 }
  })

  let res = response()
  await handler(request(), res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(calls, ['record'])
  assert.equal(JSON.parse(res.body).ok, true)
  assert.equal(JSON.parse(res.body).recorded, 2)
  assert.equal(res.headers['cache-control'], 'no-store')
})

test('baseline handler rejects non-loopback and non-POST requests', async () => {
  const handler = createBaselineHandler(async () => ({ mode: 'file', recorded: 0 }))

  let res = response()
  await handler(request({ remote: '192.168.1.2' }), res)
  assert.equal(res.statusCode, 403)

  res = response()
  await handler(request({ method: 'GET' }), res)
  assert.equal(res.statusCode, 405)
})

test('baseline handler requires JSON, a custom action header, and a record action', async () => {
  const handler = createBaselineHandler(async () => ({ mode: 'file', recorded: 0 }))

  let res = response()
  await handler(request({ contentType: 'text/plain' }), res)
  assert.equal(res.statusCode, 415)

  res = response()
  await handler(request({ action: '' }), res)
  assert.equal(res.statusCode, 400)

  res = response()
  await handler(request({ body: '{"action":"nope"}' }), res)
  assert.equal(res.statusCode, 400)

  res = response()
  await handler(request({ body: 'not-json' }), res)
  assert.equal(res.statusCode, 400)
})

test('baseline handler rejects bodies over the limit', async () => {
  const handler = createBaselineHandler(async () => ({ mode: 'file', recorded: 0 }))
  const res = response()
  await handler(request({ body: `{"action":"record","padding":"${'x'.repeat(3000)}"}` }), res)
  assert.equal(res.statusCode, 413)
})
