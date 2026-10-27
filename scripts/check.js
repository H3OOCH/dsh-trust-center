/**
 * Manifest / packaging sanity checks for the published bundle.
 * Kept dependency-free so it runs in a fresh checkout.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const failures = []

function readJson(relative) {
  try {
    return JSON.parse(readFileSync(join(root, relative), 'utf8'))
  } catch (error) {
    failures.push(`${relative}: ${error.message}`)
    return undefined
  }
}

const manifest = readJson('package.json')
if (manifest) {
  if (manifest.name !== 'dsh-trust-center') failures.push('package.json name must be dsh-trust-center')
  if (manifest.dependencies !== undefined && Object.keys(manifest.dependencies).length > 0) {
    failures.push('runtime dependencies must stay empty')
  }
  if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') failures.push('dsh.bundle.patch is missing')
  if (manifest.exports?.['./client'] !== './src/ui/client.js') failures.push('client export is missing')
  if (manifest.exports?.['./icon'] !== './icon.svg') failures.push('icon export is missing')
  if (!manifest.files?.includes('src/')) failures.push('files must include src/')
  if (manifest.license !== 'MIT') failures.push('license must be MIT')
  if (manifest.engines?.dsh === undefined) failures.push('engines.dsh is required for DSH compatibility')
  for (const peer of Object.keys(manifest.peerDependencies ?? {})) {
    if (!peer.startsWith('@deepseek-ai/')) failures.push(`peerDependency ${peer} is outside @deepseek-ai/*`)
  }
  for (const relative of [
    'src/plugin.js',
    'src/scanner.js',
    'src/status.js',
    'src/ui/client.js',
    'cordis.patch.yml',
    'icon.svg',
    'locale/en.json',
    'locale/zh.json',
    'README.md',
    'CHANGELOG.md',
    'LICENSE',
    'SECURITY.md',
  ]) {
    if (!existsSync(join(root, relative))) failures.push(`missing ${relative}`)
  }
}

const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
if (!patch.includes('trust-center')) failures.push('cordis.patch.yml does not insert the trust-center row')
if (!patch.includes('dsh-trust-center')) failures.push('cordis.patch.yml does not name dsh-trust-center')

for (const locale of ['en', 'zh']) {
  const dictionary = readJson(`locale/${locale}.json`)
  if (dictionary?.meta?.title === undefined) failures.push(`locale/${locale}.json meta.title is missing`)
  if (dictionary?.meta?.description === undefined) failures.push(`locale/${locale}.json meta.description is missing`)
}

if (existsSync(join(root, 'icon.svg')) && statSync(join(root, 'icon.svg')).size > 256 * 1024) {
  failures.push('icon.svg exceeds the 256 KiB display-resource limit')
}

if (failures.length > 0) {
  console.error('dsh-trust-center check failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log('dsh-trust-center check passed: manifest, patch, exports, locales, icon.')
}
