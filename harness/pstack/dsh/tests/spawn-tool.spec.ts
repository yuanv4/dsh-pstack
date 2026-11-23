import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it, type TestContext } from 'node:test'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SubagentRuntime } from '@deepseek-ai/dsh-subagent'
import { spawnTool, type ToolHost } from '../src/tools.ts'

const routes = [
  { provider: 'a', model: 'one', efforts: ['low'] },
  { provider: 'a', model: 'two', efforts: ['high'] },
  { provider: 'a', model: 'empty', efforts: [] },
  { provider: 'a', model: 'shared', efforts: ['low'] },
  { provider: 'b', model: 'shared', efforts: ['high'] },
]
const panel = [
  { provider: 'a', model: 'one', reasoningEffort: 'low' },
  { provider: 'a', model: 'two', reasoningEffort: 'high' },
]

async function fixture(t: TestContext, mapped: { provider: string; model: string; reasoningEffort?: string }[] = panel) {
  const home = await mkdtemp(join(tmpdir(), 'pstack-spawn-tool-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  await writeFile(join(home, 'pstack-dsh.json'), JSON.stringify({ version: 1, roles: {
    'arena runners': { inherit: false, routes: mapped },
  } }))
  const calls: Parameters<SubagentRuntime['startActivation']>[0][] = []
  let disposed = false
  const subagents = {
    async startActivation(spec: Parameters<SubagentRuntime['startActivation']>[0]) {
      calls.push(spec)
      return { childId: 'child', name: 'child', result: Promise.resolve({ output: 'done', stopReason: 'end' }), async dispose() { disposed = true } }
    },
  } as unknown as ToolHost['subagents']
  const host: ToolHost = {
    dshHome: home, subagents,
    llm: {
      listProviders: () => ['a', 'b'].map(id => ({ id, name: id })),
      async listModels(provider) { return routes.filter(r => r.provider === provider).map(r => ({ id: r.model, name: r.model })) },
      async resolveModelInfo(provider, model) {
        const route = routes.find(r => r.provider === provider && r.model === model)
        if (!route || model === 'empty') throw new Error('no metadata')
        return { id: model, name: model, reasoning: { efforts: route.efforts.map(id => ({ id, name: id })) } }
      },
    },
  }
  const tool = spawnTool(host)
  const execute = (args: Record<string, unknown> = {}) => tool.execute({ role: 'arena runners', description: 'test spawn', prompt: 'do work', ...args }, { agent: {} as Agent })
  return { execute, calls, disposed: () => disposed }
}

it('validates effort on the selected indexed route before activation', async t => {
  const f = await fixture(t)
  await assert.rejects(f.execute({ reasoning_effort: 'high' }), /effort/i)
  assert.equal(f.calls.length, 0)
  await f.execute({ route_index: 1, reasoning_effort: 'high' })
  assert.deepEqual(f.calls[0].agentOptions, { provider: 'a', model: 'two', reasoningEffort: 'high' })
})

it('clears mapped effort on a changed route and retains it on the same route', async t => {
  const f = await fixture(t)
  await f.execute({ model: 'two' })
  await f.execute({ model: 'one', provider: 'a' })
  await f.execute({ model: 'b/shared' })
  assert.deepEqual(f.calls.map(c => c.agentOptions), [
    { provider: 'a', model: 'two' },
    { provider: 'a', model: 'one', reasoningEffort: 'low' },
    { provider: 'b', model: 'shared' },
  ])
  const otherProvider = await fixture(t, [{ provider: 'a', model: 'shared', reasoningEffort: 'low' }])
  await otherProvider.execute({ model: 'shared', provider: 'b' })
  assert.deepEqual(otherProvider.calls[0].agentOptions, { provider: 'b', model: 'shared' })
})

it('rejects ambiguous models and unverified efforts without activation', async t => {
  const f = await fixture(t)
  await assert.rejects(f.execute({ model: 'shared' }), /provider/i)
  await assert.rejects(f.execute({ model: 'empty', reasoning_effort: 'high' }), /effort/i)
  assert.equal(f.calls.length, 0)
  await f.execute({ model: 'empty' })
  assert.deepEqual(f.calls[0].agentOptions, { provider: 'a', model: 'empty' })
})

it('rejects stale mapped models and efforts before activation', async t => {
  const missing = await fixture(t, [{ provider: 'a', model: 'gone' }])
  await assert.rejects(missing.execute(), /listed/i)
  assert.equal(missing.calls.length, 0)
  const stale = await fixture(t, [{ provider: 'a', model: 'one', reasoningEffort: 'high' }])
  await assert.rejects(stale.execute(), /effort/i)
  assert.equal(stale.calls.length, 0)
  const unknown = await fixture(t, [{ provider: 'a', model: 'empty', reasoningEffort: 'high' }])
  await assert.rejects(unknown.execute(), /effort/i)
  assert.equal(unknown.calls.length, 0)
})

it('rejects invalid route indexes rather than selecting the first seat', async t => {
  const f = await fixture(t)
  for (const route_index of [-1, 0.5, 2, '1', NaN]) {
    await assert.rejects(f.execute({ route_index }), /route_index/i)
  }
  assert.equal(f.calls.length, 0)
  await f.execute()
  assert.deepEqual(f.calls[0].agentOptions, { provider: 'a', model: 'one', reasoningEffort: 'low' })
})

it('keeps parent inheritance and foreground/background delivery', async t => {
  const f = await fixture(t)
  const inherited = await f.execute({ role: 'how-explorer' })
  assert.equal(f.calls[0].agentOptions, undefined)
  assert.equal(f.calls[0].delivery, 'parent')
  assert.equal((inherited as { kind: string }).kind, 'activation')
  const result = await f.execute({ run_in_background: false })
  assert.equal(f.calls[1].delivery, 'caller')
  assert.equal((result as { kind: string }).kind, 'foreground')
  assert.equal(f.disposed(), true)
  await assert.rejects(f.execute({ role: 'how-explorer', reasoning_effort: 'low' }), /needs a model/i)
  await assert.rejects(f.execute({ role: 'how-explorer', route_index: 0 }), /route_index/i)
  await assert.rejects(f.execute({ role: 'how-explorer', route_index: 0, model: 'one' }), /route_index/i)
  assert.equal(f.calls.length, 2)
})
