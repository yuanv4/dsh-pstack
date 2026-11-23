import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, type TestContext } from 'node:test'
import { buildCatalog } from '../src/catalog.ts'

async function makeHome(t: TestContext): Promise<string> {
  const home = await mkdtemp(join(tmpdir(), 'pstack-dsh-catalog-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  return home
}

describe('buildCatalog', () => {
  it('lists every model advertised by DSH regardless of provider id or local credentials', async t => {
    const catalog = await buildCatalog({
      dshHome: await makeHome(t),
      env: {},
      llm: {
        listProviders: () => [
          { id: 'deepseek-official', name: 'DeepSeek' },
          { id: 'pi-zai-coding-cn', name: 'GLM' },
          { id: 'agy-google-antigravity', name: 'Antigravity' },
          { id: 'private-proxy', name: 'Private Proxy' },
        ],
        async listModels() { return [{ id: 'model-a', name: 'Advertised Model' }] },
        async resolveModelInfo() { return { id: 'model-a', name: 'Resolved Model' } },
      },
    })

    assert.deepEqual(catalog.routes.map(({ provider, providerName, model, modelName }) => [provider, providerName, model, modelName]), [
      ['deepseek-official', 'DeepSeek', 'model-a', 'Resolved Model'],
      ['pi-zai-coding-cn', 'GLM', 'model-a', 'Resolved Model'],
      ['agy-google-antigravity', 'Antigravity', 'model-a', 'Resolved Model'],
      ['private-proxy', 'Private Proxy', 'model-a', 'Resolved Model'],
    ])
  })

  it('uses listed model ids and keeps names and effort metadata when resolution succeeds', async t => {
    const catalog = await buildCatalog({
      dshHome: await makeHome(t),
      llm: {
        listProviders: () => [{ id: 'cursor', name: 'Cursor' }],
        async listModels() {
          return [
            { id: 'reasoning-alias', name: 'Reasoning' },
            { id: 'reasoning-alias', name: 'Duplicate' },
            { id: 'fallback', name: 'Listed Fallback' },
          ]
        },
        async resolveModelInfo(_provider, model) {
          if (model === 'fallback') throw new Error('Resolution unavailable')
          return {
            id: 'canonical-id',
            name: 'Resolved Reasoning',
            reasoning: { efforts: [{ id: 'high', name: 'High', description: 'Use more time' }], defaultEffort: 'high' },
          }
        },
      },
    })

    assert.deepEqual(catalog.routes.map(({ model, modelName, efforts, defaultEffort }) => ({ model, modelName, efforts, defaultEffort })), [
      {
        model: 'reasoning-alias',
        modelName: 'Resolved Reasoning',
        efforts: [{ id: 'high', name: 'High', description: 'Use more time' }],
        defaultEffort: 'high',
      },
      { model: 'fallback', modelName: 'Listed Fallback', efforts: [], defaultEffort: undefined },
    ])
  })

  it('does not fabricate routes from local OAuth files or providers with no models', async t => {
    const home = await makeHome(t)
    await writeFile(join(home, '.dsh-oauth-auth.json'), JSON.stringify({ credentials: { anthropic: {} } }))
    const catalog = await buildCatalog({
      dshHome: home,
      llm: {
        listProviders: () => [{ id: 'offline', name: 'Offline' }, { id: 'empty', name: 'Empty' }],
        async listModels(provider) {
          if (provider === 'offline') throw new Error('Not available')
          return []
        },
        async resolveModelInfo() { throw new Error('No models to resolve') },
      },
    })

    assert.deepEqual(catalog.routes, [])
    assert.equal(catalog.inheritParent, true)
    assert.equal(catalog.emptyReason, 'DSH lists no available models. Children inherit this conversation.')
  })
})
