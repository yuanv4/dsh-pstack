import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { loadSettingsSnapshot, saveSettings, saveSettingsOverlay } from '../src/settings-api.ts'
import { draftToOverlay, overlayToDraft } from '../src/settings-draft.ts'
import { parseOverlay } from '../src/overlay-model.ts'
import { OVERLAY_FILENAME } from '../src/ids.ts'
import { DEFAULT_SETTINGS_FILENAME } from '../src/poteto-default.ts'
import { listenForCatalogChanges, type CatalogEventContext } from '../src/client/api.ts'

function llmStub() {
  return {
    listProviders: () => [{ id: 'deepseek-official', name: 'DeepSeek' }],
    async listModels() {
      return [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }]
    },
    async resolveModelInfo() {
      return { id: 'deepseek-chat', name: 'DeepSeek Chat', reasoning: { efforts: [{ id: 'high', name: 'High' }] } }
    },
  }
}

describe('settings snapshot/save', () => {
  it('loads inherit overlay and empty catalog when DSH lists no models', async () => {
    const home = await mkdtemp(join(tmpdir(), 'pstack-dsh-settings-empty-'))
    const snapshot = await loadSettingsSnapshot({
      dshHome: home,
      env: {},
      llm: {
        listProviders: () => [],
        async listModels() { return [] },
        async resolveModelInfo() { return { id: 'x', name: 'x' } },
      },
    })
    assert.equal(snapshot.catalog.routes.length, 0)
    assert.equal(snapshot.overlay.roles['feature, refactoring']?.inherit, true)
    assert.equal(snapshot.missing, true)
    assert.equal(snapshot.path.endsWith(OVERLAY_FILENAME), true)
  })

  it('writes the same overlay file spawn reads, for a DSH-listed route', async () => {
    const home = await mkdtemp(join(tmpdir(), 'pstack-dsh-settings-save-'))
    const host = {
      dshHome: home,
      env: {},
      llm: llmStub(),
    }
    const saved = await saveSettingsOverlay(host, {
      version: 1,
      roles: {
        'feature, refactoring': {
          inherit: false,
          routes: [{ provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'high' }],
        },
      },
    })
    const text = await readFile(saved.path, 'utf8')
    assert.match(text, /deepseek-official/)
    assert.match(text, /"high"/)
    const snapshot = await loadSettingsSnapshot(host)
    assert.equal(snapshot.overlay.roles['feature, refactoring']?.routes[0]?.reasoningEffort, 'high')
    assert.equal(snapshot.missing, false)
  })

  it('saves the default without querying models or rewriting saved roles', async () => {
    const home = await mkdtemp(join(tmpdir(), 'pstack-dsh-settings-default-'))
    try {
      const host = { dshHome: home, env: {}, llm: llmStub() }
      assert.equal((await loadSettingsSnapshot(host)).potetoDefault, false)
      const roles = await saveSettingsOverlay(host, {
        version: 1,
        roles: { 'bug-fix': { inherit: false, routes: [{ provider: 'deepseek-official', model: 'deepseek-chat' }] } },
      })
      const original = await readFile(roles.path, 'utf8')
      const offline = {
        ...host,
        llm: { ...host.llm, async listModels(): Promise<never> { throw new Error('provider unavailable') } },
      }
      assert.deepEqual((await loadSettingsSnapshot(offline)).droppedRoles, ['bug-fix'])
      const unavailable = { ...offline, llm: { ...offline.llm, listProviders(): never { throw new Error('must not query models') } } }
      assert.deepEqual(await saveSettings(unavailable, { potetoDefault: true }), { potetoDefault: true })
      assert.equal(await readFile(roles.path, 'utf8'), original)
      assert.deepEqual(JSON.parse(await readFile(join(home, DEFAULT_SETTINGS_FILENAME), 'utf8')), {
        version: 1, potetoDefault: true,
      })
      await saveSettings(host, { overlay: roles.overlay })
      assert.equal((await loadSettingsSnapshot(host)).potetoDefault, true)
      await assert.rejects(() => saveSettings(host, { potetoDefault: 'yes' }), /potetoDefault must be a boolean/)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('rejects combined saves before writing either setting and isolates write failures', async () => {
    const home = await mkdtemp(join(tmpdir(), 'pstack-dsh-settings-failure-'))
    try {
      const host = { dshHome: home, env: {}, llm: llmStub() }
      const initial = await saveSettingsOverlay(host, {
        version: 1,
        roles: { 'bug-fix': { inherit: false, routes: [{ provider: 'deepseek-official', model: 'deepseek-chat' }] } },
      })
      const original = await readFile(initial.path, 'utf8')
      await assert.rejects(() => saveSettings(host, {
        overlay: { version: 1, roles: {} }, potetoDefault: true,
      }), /separate requests/)
      assert.equal(await readFile(initial.path, 'utf8'), original)
      await assert.rejects(readFile(join(home, DEFAULT_SETTINGS_FILENAME)), { code: 'ENOENT' })
      await mkdir(join(home, DEFAULT_SETTINGS_FILENAME))
      await assert.rejects(() => saveSettings(host, { potetoDefault: true }))
      assert.equal(await readFile(initial.path, 'utf8'), original)
      await saveSettings(host, { overlay: { version: 1, roles: {} } })
      assert.equal(parseOverlay(await readFile(initial.path, 'utf8')).roles['bug-fix']?.inherit, true)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })

  it('keeps user effort and stale legacy critics on disk through Settings load and draft save', async () => {
    const home = await mkdtemp(join(tmpdir(), 'pstack-dsh-settings-legacy-'))
    const host = {
      dshHome: home,
      env: {},
      llm: llmStub(),
    }
    const original = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        'bug-fix': {
          inherit: false,
          routes: [{ provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'high' }],
        },
        'how-critics': {
          inherit: false,
          routes: [
            { provider: 'retired-provider', model: 'retired-model', reasoningEffort: 'legacy-max' },
            { provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'obsolete-effort' },
          ],
        },
      },
    }))
    const path = join(home, OVERLAY_FILENAME)
    const bytes = JSON.stringify(original)
    await writeFile(path, bytes)
    const loaded = await loadSettingsSnapshot(host)
    assert.deepEqual(loaded.droppedRoles, [])
    assert.deepEqual(loaded.overlay, original)
    assert.equal(await readFile(path, 'utf8'), bytes)
    const saved = await saveSettingsOverlay(host, draftToOverlay(overlayToDraft(loaded.overlay)))
    assert.deepEqual(saved.overlay, original)
    assert.deepEqual(parseOverlay(await readFile(path, 'utf8')), original)
    assert.deepEqual((await loadSettingsSnapshot(host)).overlay, original)
  })

  it('rejects a vendor slug the live catalog does not list', async () => {
    const home = await mkdtemp(join(tmpdir(), 'pstack-dsh-settings-reject-'))
    await assert.rejects(() => saveSettingsOverlay({
      dshHome: home,
      env: {},
      llm: llmStub(),
    }, {
      version: 1,
      roles: {
        feature: { inherit: false, routes: [{ provider: 'openai', model: 'gpt-4' }] },
      },
    }), /not listed by DSH/)
  })

  it('sees DSH model additions and removals on the next request, including save validation', async () => {
    const home = await mkdtemp(join(tmpdir(), 'pstack-dsh-settings-login-'))
    const models: { id: string; name: string }[] = []
    const host = {
      dshHome: home,
      env: {},
      llm: {
        listProviders: () => [{ id: 'pi-zai-coding-cn', name: 'GLM' }],
        async listModels() { return models },
        async resolveModelInfo(_provider: string, model: string) { return { id: model, name: model } },
      },
    }
    assert.equal((await loadSettingsSnapshot(host)).catalog.routes.length, 0)
    models.push({ id: 'glm-5.3-flash', name: 'GLM' })
    const available = await loadSettingsSnapshot(host)
    assert.deepEqual(available.catalog.routes.map(route => route.model), ['glm-5.3-flash'])

    const saved = await saveSettingsOverlay(host, {
      version: 1,
      roles: { feature: { inherit: false, routes: [{ provider: 'pi-zai-coding-cn', model: 'glm-5.3-flash' }] } },
    })
    models.push({ id: 'new-live-model', name: 'New live model' })
    assert.equal((await loadSettingsSnapshot(host)).catalog.routes.length, 2)

    const savedBytes = await readFile(saved.path, 'utf8')
    models.length = 0
    const unavailable = await loadSettingsSnapshot(host)
    assert.equal(unavailable.catalog.routes.length, 0)
    assert.deepEqual(unavailable.droppedRoles, ['feature, refactoring'])
    assert.equal(await readFile(saved.path, 'utf8'), savedBytes)
    await assert.rejects(() => saveSettingsOverlay(host, saved.overlay), /not listed by DSH/)
  })
})

describe('client catalog notifications', () => {
  it('refreshes on Host adapter, model, settings, credential and reconnect events, then unsubscribes', () => {
    const listeners = new Map<string, () => void>()
    const subscribe = (event: string, listener: () => void) => {
      listeners.set(event, listener)
      return () => { listeners.delete(event) }
    }
    const ctx: CatalogEventContext = { remote: { $on: subscribe }, on: subscribe }
    let refreshes = 0
    const stop = listenForCatalogChanges(ctx, () => { refreshes += 1 })
    for (const event of ['llm/adapters-updated', 'llm/models-updated', 'settings/document-updated', 'credentials/reference-updated', 'connection/reset']) {
      const listener = listeners.get(event)
      assert.ok(listener, `${event} must reach the role selector`)
      listener()
    }
    assert.equal(refreshes, 5)
    stop()
    assert.equal(listeners.size, 0)
  })
})
