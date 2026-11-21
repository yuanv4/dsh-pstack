import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  parseOverlay,
  readOverlay,
  validateOverlayAgainstCatalog,
  writeOverlay,
} from '../src/overlay.ts'
import type { LiveRoute } from '../src/catalog-types.ts'

const live: LiveRoute[] = [
  {
    provider: 'deepseek-official',
    providerName: 'DeepSeek',
    model: 'deepseek-chat',
    modelName: 'DeepSeek Chat',
    efforts: [{ id: 'high', name: 'High' }],
  },
  {
    provider: 'pi-anthropic',
    providerName: 'Claude',
    model: 'claude-sonnet-4-6',
    modelName: 'Sonnet',
    efforts: [],
  },
]

describe('overlay', () => {
  it('treats a missing file as inherit for every role', async () => {
    const home = await mkdtemp(join(tmpdir(), 'pstack-dsh-overlay-missing-'))
    const current = await readOverlay(home)
    assert.equal(current.missing, true)
    assert.equal(current.overlay.roles['feature, refactoring']?.inherit, true)
    assert.deepEqual(current.overlay.roles['feature, refactoring']?.routes, [])
  })

  it('parses inherit-parent aliases and rejects extra fields', () => {
    const overlay = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        'feature, refactoring': { inherit: 'auto', routes: [] },
      },
    }))
    assert.equal(overlay.roles['feature, refactoring']?.inherit, true)
    assert.throws(() => parseOverlay(JSON.stringify({
      version: 1,
      roles: { 'feature, refactoring': { inherit: false, routes: [{ provider: 'x', model: 'y', extra: true }] } },
    })))
    assert.throws(() => parseOverlay(JSON.stringify({
      version: 1,
      roles: { 'not-a-role': { inherit: true, routes: [] } },
    })), /unknown/)
  })

  it('rejects a scalar role with two routes', () => {
    assert.throws(() => parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        'feature, refactoring': {
          inherit: false,
          routes: [
            { provider: 'deepseek-official', model: 'deepseek-chat' },
            { provider: 'pi-anthropic', model: 'claude-sonnet-4-6' },
          ],
        },
      },
    })))
  })

  it('migrates legacy role names and drops the retired ones', () => {
    const overlay = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        feature: { inherit: false, routes: [{ provider: 'deepseek-official', model: 'deepseek-chat' }] },
        'judgment-and-prose': { inherit: false, routes: [{ provider: 'deepseek-official', model: 'deepseek-chat' }] },
        'arena-runners': { inherit: false, routes: [{ provider: 'deepseek-official', model: 'deepseek-chat' }] },
        'how-critics': { inherit: false, routes: [{ provider: 'old', model: 'old', reasoningEffort: 'legacy-max' }] },
        'hardest-tasks': { inherit: false, routes: [{ provider: 'old', model: 'old' }] },
        'poteto-agent': { inherit: false, routes: [{ provider: 'old', model: 'old' }] },
      },
    }))
    assert.equal(Object.keys(overlay.roles).length, 9)
    assert.equal(overlay.roles['feature, refactoring']?.routes.length, 1)
    assert.equal(overlay.roles['judgment and prose']?.routes.length, 1)
    assert.equal(overlay.roles['arena runners']?.routes.length, 1)
    assert.equal('how-critics' in overlay.roles, false)
    assert.equal('hardest-tasks' in overlay.roles, false)
    assert.equal('poteto-agent' in overlay.roles, false)
  })

  it('validates routes and efforts against the live catalog', () => {
    const good = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        'feature, refactoring': {
          inherit: false,
          routes: [{ provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'high' }],
        },
      },
    }))
    assert.deepEqual(validateOverlayAgainstCatalog(good, live), [])

    const unlisted = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        'feature, refactoring': {
          inherit: false,
          routes: [{ provider: 'openai', model: 'gpt-4' }],
        },
      },
    }))
    assert.match(validateOverlayAgainstCatalog(unlisted, live).join('\n'), /not listed by DSH/)

    const noEffort = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        'judgment and prose': {
          inherit: false,
          routes: [{ provider: 'pi-anthropic', model: 'claude-sonnet-4-6', reasoningEffort: 'xhigh' }],
        },
      },
    }))
    assert.match(validateOverlayAgainstCatalog(noEffort, live).join('\n'), /has no effort field/)

    const wrongEffort = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        'feature, refactoring': {
          inherit: false,
          routes: [{ provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'max' }],
        },
      },
    }))
    assert.match(validateOverlayAgainstCatalog(wrongEffort, live).join('\n'), /not accepted/)
  })

  it('reports every route of a panel role with its index', () => {
    const panel = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        'arena runners': {
          inherit: false,
          routes: [
            { provider: 'retired-provider', model: 'retired-model' },
            { provider: 'openai', model: 'gpt-4' },
          ],
        },
      },
    }))
    const errors = validateOverlayAgainstCatalog(panel, live)
    assert.equal(errors.length, 2)
    assert.ok(errors.every(error => error.startsWith('arena runners[')))
  })

  it('round-trips a write', async () => {
    const home = await mkdtemp(join(tmpdir(), 'pstack-dsh-overlay-write-'))
    const overlay = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        'feature, refactoring': {
          inherit: false,
          routes: [{ provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'high' }],
        },
      },
    }))
    const path = await writeOverlay(overlay, home)
    const current = await readOverlay(home)
    assert.equal(current.missing, false)
    assert.equal(current.path, path)
    assert.equal(current.overlay.roles['feature, refactoring']?.inherit, false)
    assert.equal(current.overlay.roles['feature, refactoring']?.routes[0]?.reasoningEffort, 'high')
  })

  it('keeps the previous overlay intact when the atomic replacement cannot start', { skip: process.platform === 'win32' }, async () => {
    const home = await mkdtemp(join(tmpdir(), 'pstack-dsh-overlay-failure-'))
    const path = join(home, 'pstack-dsh.json')
    const original = '{"version":1,"roles":{}}\n'
    const replacement = parseOverlay(JSON.stringify({
      version: 1,
      roles: { 'feature, refactoring': { inherit: false, routes: [{ provider: 'deepseek-official', model: 'deepseek-chat' }] } },
    }))
    await writeFile(path, original, { mode: 0o600 })
    await chmod(home, 0o500)
    try {
      await assert.rejects(() => writeOverlay(replacement, home))
      assert.equal(await readFile(path, 'utf8'), original)
    } finally {
      await chmod(home, 0o700)
    }
  })
})
