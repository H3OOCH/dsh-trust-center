import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
const patch = readFileSync(new URL('cordis.patch.yml', root), 'utf8')

test('package manifest satisfies the DSH bundle contract', () => {
  assert.equal(manifest.name, 'dsh-trust-center')
  assert.equal(manifest.main, './src/plugin.js')
  assert.equal(manifest.type, 'module')
  assert.equal(manifest.license, 'MIT')
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(manifest.exports['./client'], './src/ui/client.js')
  assert.equal(manifest.exports['./icon'], './icon.svg')
  assert.ok(manifest.files.includes('src/'))
  assert.ok(manifest.files.includes('locale/*.json'))
  assert.equal(manifest.engines.dsh, '>=0.2.1-rc.2 <0.3.0-0')
  assert.equal(manifest.dependencies, undefined)
  for (const peer of Object.keys(manifest.peerDependencies ?? {})) {
    assert.ok(peer.startsWith('@deepseek-ai/'), `unexpected peer ${peer}`)
  }
})

test('bundle patch inserts the package under a stable id', () => {
  assert.match(patch, /id:\s*trust-center/)
  assert.match(patch, /name:\s*dsh-trust-center/)
})

test('all published support files exist and stay bounded', () => {
  for (const file of ['README.md', 'CHANGELOG.md', 'LICENSE', 'SECURITY.md', 'icon.svg', 'locale/en.json', 'locale/zh.json']) {
    assert.equal(existsSync(new URL(file, root)), true, `${file} missing`)
  }
  assert.ok(statSync(new URL('icon.svg', root)).size < 256 * 1024)
  for (const locale of ['en', 'zh']) {
    const dictionary = JSON.parse(readFileSync(new URL(`locale/${locale}.json`, root), 'utf8'))
    assert.equal(typeof dictionary.meta.title, 'string')
    assert.equal(typeof dictionary.meta.description, 'string')
  }
})
