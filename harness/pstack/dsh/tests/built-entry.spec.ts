import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { it } from 'node:test'
import type { Context } from '@deepseek-ai/cordis'
import * as entry from '../dist/index.js'
import { PSTACK_TOOLS } from '../src/ids.ts'
import { NATIVE_DELEGATION_TOOLS, writeModes } from '../src/poteto-mode.ts'

type Tool = { name: string; execute(args: Record<string, unknown>, context: unknown): Promise<unknown> }
type ListedSkill = { name: string; invocation: { modelInvocable: boolean; userInvocable: boolean } }
type Provider = { list(options?: { scope?: unknown }): Promise<ListedSkill[]> }

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

it('applies the session switch surface through the built entry', async () => isolatedHome(async () => {
  interface Host {
    agent: { session: { id: string; header: { origin: string } } }
    denies: string[][]
    sections: string[]
    skills: Provider
  }

  /** One fake host boot, so the same packaged apply can be observed on both switch states. */
  function boot(): Host {
    const denies: string[][] = []
    const sections: string[] = []
    const names: string[] = [...PSTACK_TOOLS, ...NATIVE_DELEGATION_TOOLS]
    const tools = {
      get: (name: string) => names.includes(name) ? { name } : undefined,
      restrict: (filter: { deny?: readonly string[] }) => {
        denies.push([...(filter.deny ?? [])])
        return () => {}
      },
    }
    const agent = {
      session: { id: 'live-session', header: { origin: 'user' } },
      ctx: {
        get: (name: string) => name === 'tools'
          ? tools
          : name === 'systemPrompt'
            ? { section: (section: { text: string }) => { sections.push(section.text); return () => {} } }
            : undefined,
      },
    }
    const services: Record<string, unknown> = {
      agents: { list: () => [agent], get: (id: string) => id === agent.session.id ? agent : undefined },
    }
    let skills: Provider | undefined
    const skillProvider = {
      registerProvider: (create: (control: { invalidate(): void }) => Provider) => {
        skills = create({ invalidate: () => {} })
        return () => {}
      },
    }
    entry.apply({ get: (name: string) => services[name], on: () => () => {}, inject() {}, skills: skillProvider, tools: { register() {} } } as unknown as Context)
    assert.ok(skills)
    return { agent, denies, sections, skills }
  }

  const off = boot()
  assert.deepEqual(off.denies.at(-1), [...PSTACK_TOOLS], 'switch off withholds every bundled tool')
  assert.deepEqual(off.sections, [], 'switch off adds no prompt section')
  const hidden = await off.skills.list({ scope: off.agent })
  assert.ok(hidden.length > 0)
  assert.deepEqual(hidden.filter(skill => skill.invocation.modelInvocable || skill.invocation.userInvocable), [], 'switch off withdraws the skills from both surfaces')

  await writeModes(new Set(['live-session']))
  const on = boot()
  assert.deepEqual(on.denies.at(-1), [...NATIVE_DELEGATION_TOOLS], 'switch on withholds the native delegation tools')
  assert.equal(on.sections.length, 1, 'switch on adds the poteto-mode prompt section')
  assert.match(on.sections[0], /poteto-mode/)
  const shown = await on.skills.list({ scope: on.agent })
  const architect = shown.find(skill => skill.name === 'architect')
  assert.equal(architect?.invocation.modelInvocable, true, 'switch on returns the bundled skills')
  assert.equal(architect?.invocation.userInvocable, true)
  assert.equal(shown.find(skill => skill.name === 'poteto-mode')?.invocation.modelInvocable, false)
  assert.equal('readModes' in entry, false)
}))
