import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, inject, name } from '../src/plugin.js'
import { STATUS_PATH } from '../src/status.js'

function makePluginContext({ withTools = true, withWebServer = true } = {}) {
  const routes = []
  const tools = []
  const listeners = new Map()
  const webServer = {
    register(route) {
      routes.push(route)
      return () => {
        const index = routes.indexOf(route)
        if (index >= 0) routes.splice(index, 1)
      }
    },
  }
  const registry = {
    register(definition) {
      tools.push(definition)
      return () => {
        const index = tools.indexOf(definition)
        if (index >= 0) tools.splice(index, 1)
      }
    },
  }
  const services = {
    ...(withTools ? { tools: registry } : {}),
    ...(withWebServer ? { webServer } : {}),
  }
  const ctx = {
    logger: { info() {}, warn() {}, debug() {} },
    on(event, listener) {
      listeners.set(event, listener)
      return () => listeners.delete(event)
    },
    get(service) {
      return services[service]
    },
    inject(names, callback) {
      if (!names.every((service) => services[service] !== undefined)) return () => {}
      return callback({
        ...ctx,
        ...(services.tools === undefined ? {} : { tools: registry }),
        ...(services.webServer === undefined ? {} : { webServer }),
      })
    },
    effect(setup) {
      const disposer = setup()
      return disposer
    },
  }
  return { ctx, routes, tools, services }
}

test('plugin manifest exports a loadable no-hard-dependency plugin', () => {
  assert.equal(name, 'trust-center')
  assert.deepEqual(inject, [])
  assert.equal(typeof apply, 'function')
})

test('plugin registers the loopback snapshot route and trust_scan tool', () => {
  const { ctx, routes, tools } = makePluginContext()
  apply(ctx)
  assert.equal(routes.length, 1)
  assert.equal(routes[0].path, STATUS_PATH)
  assert.equal(routes[0].kind, 'exact')
  assert.equal(tools.length, 1)
  assert.equal(tools[0].name, 'trust_scan')
  assert.equal(tools[0].output.schema.type, 'string')
  assert.equal(typeof tools[0].execute, 'function')
})

test('plugin remains loadable without tools and without a web server', () => {
  const { ctx, routes, tools } = makePluginContext({ withTools: false, withWebServer: false })
  assert.doesNotThrow(() => apply(ctx))
  assert.equal(routes.length, 0)
  assert.equal(tools.length, 0)
})

test('the agent tool returns a readable report and can emit JSON', async () => {
  const { ctx, tools } = makePluginContext()
  apply(ctx)
  const tool = tools[0]
  const markdown = await tool.execute({})
  assert.match(markdown, /DSH Trust Center/)
  const json = JSON.parse(await tool.execute({ format: 'json' }))
  assert.equal(json.product, 'dsh-trust-center')
  assert.ok(Array.isArray(json.findings))
})
