import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import type { Context } from '@deepseek-ai/cordis'
import * as entry from '../dist/index.js'

type Tool = { name: string; execute(args: Record<string, unknown>, context: unknown): Promise<unknown> }
type Command = { name: string; description: string; handler(input: { agent: unknown; rawInput: string }): Promise<{ kind: string; text?: string }> }
type PreStep = (payload: unknown, next: () => Promise<{ kind: string; messages: unknown[] }>) => Promise<{ kind: string; messages: unknown[] }>

async function isolatedHome(run: () => Promise<void>) {
  const prefix = join(tmpdir(), 'pstack-built-entry-')
  const home = await mkdtemp(prefix)
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    await run()
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    if (!home.startsWith(prefix) || home === prefix) throw new Error('Unexpected temporary directory')
    await rm(home, { recursive: true, force: true })
  }
}

it('routes through tools registered by the built entry', async () => isolatedHome(async () => {
  const tools = new Map<string, Tool>()
  const requests: Array<{ agentOptions?: unknown; delivery?: string }> = []
  const model = 'gpt-6.1-sol'
  let signedIn = true
  const services: Record<string, unknown> = {
    llm: {
      listProviders: () => [{ id: 'codex', name: 'ChatGPT' }, { id: 'private-proxy', name: 'Private Proxy' }],
      listModels: async (id: string) => id === 'codex' && !signedIn ? [] : [{ id: model, name: 'Sol' }],
      resolveModelInfo: async () => ({ id: model, name: 'Sol', reasoning: { efforts: [{ id: 'high', name: 'High' }] } }),
    },
    subagents: { async startActivation(request: { agentOptions?: unknown; delivery?: string }) {
      requests.push(request)
      return { childId: 'child-1', name: 'agent-1', result: Promise.resolve({ output: 'ok', stopReason: 'completed' }), async dispose() {} }
    } },
  }
  entry.apply({ tools: { register: (tool: Tool) => tools.set(tool.name, tool) }, skills: { registerProvider() {} }, get: (name: string) => services[name], inject() {}, on() {} } as unknown as Context)
  const run = async (name: string, args: Record<string, unknown> = {}) => {
    const tool = tools.get(name)
    assert.ok(tool, `${name} is registered`)
    return await tool.execute(args, { agent: { id: 'test-parent' }, signal: new AbortController().signal })
  }
  const catalog = await run('pstack_catalog') as { routes: Array<{ provider: string; model: string; efforts: Array<{ id: string }> }> }
  assert.deepEqual(catalog.routes.map(r => [r.provider, r.model, r.efforts[0].id]), [['codex', model, 'high'], ['private-proxy', model, 'high']])
  const overlayFor = (reasoningEffort: string) => ({ version: 1, roles: { 'feature, refactoring': { inherit: false, routes: [{ provider: 'codex', model, reasoningEffort }] } } })
  await assert.rejects(run('pstack_overlay_write', { overlay: overlayFor('low') }), /not accepted/)
  const written = await run('pstack_overlay_write', { overlay: overlayFor('high') }) as { overlay: { roles: Record<string, unknown> } }
  assert.deepEqual(written.overlay.roles['feature, refactoring'], overlayFor('high').roles['feature, refactoring'])
  assert.deepEqual((await run('pstack_overlay_read') as { overlay: unknown }).overlay, written.overlay)
  const task = { role: 'feature', description: 'Verify routed child', prompt: 'Reply with ok.' }
  assert.deepEqual(await run('pstack_spawn', task), { kind: 'activation', subagentId: 'child-1', name: 'agent-1', role: 'feature, refactoring', inherit: false, routeSource: 'role' })
  assert.deepEqual(requests[0].agentOptions, { provider: 'codex', model, reasoningEffort: 'high' })
  assert.equal(requests[0].delivery, 'parent')
  const override = await run('pstack_spawn', { ...task, model, provider: 'private-proxy', reasoning_effort: 'high' }) as { routeSource: string }
  assert.equal(override.routeSource, 'call')
  assert.deepEqual(requests[1].agentOptions, { provider: 'private-proxy', model, reasoningEffort: 'high' })
  await assert.rejects(run('pstack_spawn', { ...task, model: 'not-listed' }), /not listed by DSH/)
  assert.equal(requests.length, 2)
  signedIn = false
  assert.deepEqual((await run('pstack_catalog') as typeof catalog).routes.map(r => r.provider), ['private-proxy'])
  await assert.rejects(run('pstack_overlay_write', { overlay: overlayFor('high') }), /not listed by DSH/)
}))

it('registers and removes poteto behavior through the built entry', async () => isolatedHome(async () => {
  const commands: Command[] = []
  const listeners = new Map<string, PreStep>()
  const denies: string[][] = []
  const sections: string[] = []
  let lifts = 0
  const tools = {
    get: (name: string) => ['subagent', 'subagent_fork'].includes(name) ? { name } : undefined,
    restrict: (filter: { deny?: readonly string[] }) => {
      denies.push([...(filter.deny ?? [])])
      return () => { lifts += 1 }
    },
  }
  const agentServices: Record<string, unknown> = { tools, systemPrompt: { section: (section: { text: string }) => {
    sections.push(section.text)
    return () => { sections.pop() }
  } } }
  const agent = { session: { id: 'live-session', header: { origin: 'user' } }, ctx: { get: (name: string) => agentServices[name] } }
  const services: Record<string, unknown> = {
    commands: { register: (command: Command) => { commands.push(command); return () => {} } },
    agents: { list: () => [agent], get: (id: string) => id === agent.session.id ? agent : undefined },
  }
  entry.apply({ get: (name: string) => services[name], on: (event: string, handler: PreStep) => { listeners.set(event, handler); return () => {} }, inject() {}, skills: { registerProvider() {} }, tools: { register() {} } } as unknown as Context)
  const command = commands.find(item => item.name === 'pstack-poteto-mode')
  assert.ok(command)
  assert.match(command.description, /native subagent/)
  const invoke = (rawInput: string) => command.handler({ agent, rawInput })
  assert.match((await invoke('status')).text ?? '', /off/)
  assert.equal((await invoke(' on ')).kind, 'success')
  assert.deepEqual(denies, [['subagent', 'subagent_fork']])
  assert.equal(sections.length, 1)
  assert.match(sections[0], /poteto-mode/)
  const preStep = listeners.get('agent/pre-step')
  assert.ok(preStep)
  const turn = (id: string) => preStep({ agent, messages: [{ id, source: { kind: 'user' } }] }, async () => ({ kind: 'enter', messages: [] }))
  const decision = await turn('user-1')
  assert.equal(decision.messages.length, 1)
  assert.match(JSON.stringify(decision.messages[0]), /Poteto workflow is active/)
  assert.match((await invoke('status')).text ?? '', /on/)
  assert.equal((await invoke('off')).kind, 'success')
  assert.equal(lifts, 1)
  assert.deepEqual(sections, [])
  assert.equal((await turn('user-2')).messages.length, 0)
  assert.equal('readModes' in entry, false)
}))
