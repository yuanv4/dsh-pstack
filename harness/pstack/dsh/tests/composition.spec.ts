import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { OVERLAY_FILENAME, PLUGIN_ID, POTETO_STATE_PATH, SETTINGS_SAVE_PATH, SETTINGS_SNAPSHOT_PATH, SKILL_PROVIDER_NAME } from '../src/ids.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

describe('bundle composition', () => {
  it('is installable with stock dsh plugin add from git', async () => {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      name: string
      version: string
      main: string
      scripts: Record<string, string>
      dsh: { bundle?: { patch?: string }; client: { platform: string; inject: string[] } }
    }
    assert.equal(pkg.name, 'dsh-pstack')
    assert.equal(pkg.dsh.bundle?.patch, './cordis.patch.yml')
    assert.equal(pkg.scripts.prepare, undefined)
    assert.equal(pkg.main, 'harness/pstack/dsh/dist/index.js')
    const [host, client, patch] = await Promise.all([
      readFile(join(root, 'harness/pstack/dsh/dist/index.js'), 'utf8'),
      readFile(join(root, 'harness/pstack/dsh/dist/client.js'), 'utf8'),
      readFile(join(root, 'cordis.patch.yml'), 'utf8'),
    ])
    assert.match(host, /function apply\(/)
    assert.match(host, /export \{[^}]*\bapply\b/)
    assert.match(client, /window\.__ModuleLoader__\.load\(\{\s*id:\s*["']dsh-pstack["']/)
    assert.equal(PLUGIN_ID, pkg.name)
    assert.equal(SKILL_PROVIDER_NAME, pkg.name)
    assert.equal(OVERLAY_FILENAME, 'pstack-dsh.json')
    assert.equal(SETTINGS_SNAPSHOT_PATH, '/plugins/dsh-pstack/settings')
    assert.equal(SETTINGS_SAVE_PATH, '/plugins/dsh-pstack/settings')
    assert.equal(POTETO_STATE_PATH, '/plugins/dsh-pstack/poteto')
    assert.match(patch, /id:\s*dsh-pstack/)
    assert.match(patch, /name:\s*dsh-pstack/)
    const manifest = await readFile(join(root, 'package.json'), 'utf8')
    assert.doesNotMatch(manifest, /\btsdown\b|\bdshx\.yml\b/)
  })

  it('declares a web client half on the plugin page, not a second config file', async () => {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      name: string
      exports: Record<string, unknown>
      dsh: { client: { platform: string; inject: string[] } }
    }
    assert.equal(pkg.name, 'dsh-pstack')
    assert.equal(pkg.exports['./client'], './harness/pstack/dsh/dist/client.js')
    assert.equal(pkg.dsh.client.platform, 'web')
    assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-plugin-manager'))
    assert.ok(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-locale'))
  })

  it('registers the bundle configuration page for pstack from the client entry', async () => {
    const source = await readFile(join(root, 'harness/pstack/dsh/src/client/index.tsx'), 'utf8')
    assert.match(source, /export function apply/)
    assert.match(source, /export const inject = \['slots', 'locale', 'remote'\]/)
    assert.doesNotMatch(source, /export\s+default\s+/)
    // DSH renders a bundle's own configuration on its Plugins page; a second
    // surface beside it (a head action and its dialog) is what this replaces.
    assert.match(source, /ctx\.slots\.inject\('plugins\.bundle\.config'/)
    assert.match(source, /key: PLUGIN_ID/)
    assert.doesNotMatch(source, /plugins\.detail\.actions/)
    assert.doesNotMatch(source, /<dialog/)
  })
})
