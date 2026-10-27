import assert from 'node:assert/strict'
import test from 'node:test'

test('client half registers a Trust Center sidebar entry, main panel, and settings section', async () => {
  const registrations = []
  let loaded
  const previousWindow = globalThis.window
  globalThis.window = {
    __ModuleLoader__: {
      load(definition) {
        loaded = definition
      },
    },
  }
  try {
    await import(`../src/ui/client.js?test=${Date.now()}`)
    assert.equal(loaded.id, 'dsh-trust-center')
    const module = loaded.factory((specifier) => {
      assert.equal(specifier, 'react')
      return { createElement: () => null }
    })
    assert.equal(module.name, 'dsh-trust-center-client')
    assert.deepEqual(module.inject, ['slots', 'locale'])

    const ctx = {
      effect(setup) {
        return setup()
      },
      locale: {
        register() {
          return () => {}
        },
        bind(namespace) {
          assert.equal(namespace, 'dsh-trust-center')
          return (key) => key
        },
        subscribe() {
          return () => {}
        },
        getSnapshot() {
          return { active: 'zh' }
        },
      },
      slots: {
        inject(name, callback) {
          callback()
          return () => {}
        },
        register(metadata, component) {
          registrations.push({ metadata, component })
          return () => {}
        },
      },
    }
    module.apply(ctx)
    assert.equal(registrations.length, 3)
    const sidebar = registrations.find((entry) => entry.metadata.name === 'sidebar.panellist')
    const main = registrations.find((entry) => entry.metadata.name === 'main')
    const settings = registrations.find((entry) => entry.metadata.name === 'settings.section')
    assert.equal(sidebar.metadata.id, 'trust-center')
    assert.equal(sidebar.metadata.order, 20)
    assert.equal(sidebar.metadata.label(), 'nav')
    assert.equal(main.metadata.key, 'trust-center')
    assert.equal(settings.metadata.id, 'trust-center')
    assert.equal(settings.metadata.order, 45)
    assert.equal(typeof sidebar.component, 'function')
    assert.equal(typeof main.component, 'function')
    assert.equal(typeof settings.component, 'function')
  } finally {
    globalThis.window = previousWindow
  }
})
