import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Context } from '@deepseek-ai/cordis'
import { PSTACK_TOOLS } from '../src/ids.ts'
import { writePotetoDefault } from '../src/poteto-default.ts'
import {
  NATIVE_DELEGATION_TOOLS,
  createPotetoSkillGate,
  modePath,
  potetoSkillText,
  readModes,
  registerPotetoMode,
  writeModes,
} from '../src/poteto-mode.ts'

interface FakeToolRuntime {
  names: string[]
  denies: string[][]
  lifts: number
  get(name: string, scope?: unknown): unknown
  onChange: () => void
  active: Set<readonly string[]>
  restrict(filter: { deny?: readonly string[] }): () => void
}

function fakeTools(names: string[] = [...PSTACK_TOOLS, ...NATIVE_DELEGATION_TOOLS]): FakeToolRuntime {
  const runtime: FakeToolRuntime = {
    names,
    denies: [],
    lifts: 0,
    onChange: () => {},
    active: new Set(),
    get: (name: string, scope?: unknown) => (runtime.names.includes(name)
      && (scope === undefined || ![...runtime.active].some(deny => deny.includes(name))) ? { name } : undefined),
    restrict: (filter: { deny?: readonly string[] }) => {
      const deny = [...(filter.deny ?? [])]
      runtime.denies.push(deny)
      runtime.active.add(deny)
      runtime.onChange()
      return () => {
        runtime.active.delete(deny)
        runtime.lifts += 1
        runtime.onChange()
      }
    },
  }
  return runtime
}

function fakeAgent(id: string, origin: 'user' | 'subagent', services: Record<string, unknown>, parentSession?: string): Agent {
  const header = { origin, ...parentSession === undefined ? {} : { parentSession } }
  return {
    session: { id, header },
    ctx: { get: (name: string) => services[name] },
  } as unknown as Agent
}

interface Harness {
  ctx: Context
  agent: Agent
  tools: FakeToolRuntime
  sections: string[]
  agents: Agent[]
  emit(event: string, payload?: unknown): unknown
  hasListener(event: string): boolean
}

function harness(primary?: Agent): Harness {
  const tools = fakeTools()
  const sections: string[] = []
  const listeners = new Map<string, (payload?: unknown) => void>()
  const prompt = {
    section: (section: { text: string }) => {
      sections.push(section.text)
      return () => {
        const index = sections.lastIndexOf(section.text)
        if (index >= 0) sections.splice(index, 1)
      }
    },
  }
  tools.onChange = () => listeners.get('tools/change')?.()
  const agent = primary ?? fakeAgent('session-root', 'user', { tools, systemPrompt: prompt })
  const agents = [agent]
  const ctx = {
    get: (name: string) => name === 'agents'
      ? { list: () => agents, get: (id: string) => agents.find(entry => String(entry.session.id) === id) }
      : undefined,
    on: (event: string, handler: (payload?: unknown) => void) => {
      listeners.set(event, handler)
      return () => {}
    },
  } as unknown as Context
  return {
    ctx,
    agent,
    tools,
    sections,
    agents,
    emit(event, payload) {
      return listeners.get(event)?.(payload)
    },
    hasListener(event) {
      return listeners.has(event)
    },
  }
}

/** A delegate whose own services are separate, so its tool surface can be inspected. */
function delegate(id: string, parentSession: string): { agent: Agent; tools: FakeToolRuntime } {
  const tools = fakeTools()
  return { agent: fakeAgent(id, 'subagent', { tools, systemPrompt: { section: () => () => {} } }, parentSession), tools }
}

const previousHome = process.env.DSH_HOME

describe('poteto switch', () => {
  let home: string

  before(async () => {
    home = await mkdtemp(join(tmpdir(), 'pstack-poteto-'))
    process.env.DSH_HOME = home
  })

  after(async () => {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    await rm(home, { recursive: true, force: true })
  })

  it('withholds every bundled tool and the prompt while the switch is off', async () => {
    await writeModes(new Set())
    const test = harness()
    const api = registerPotetoMode(test.ctx)
    assert.deepEqual(test.tools.denies, [[...PSTACK_TOOLS]])
    assert.deepEqual(test.sections, [])
    assert.deepEqual(api.read('session-root').denied.sort(), [...PSTACK_TOOLS].sort())
    assert.equal(api.read('session-root').enabled, false)
  })

  it('converges synchronous tool changes on startup, sync and agent creation', async () => {
    await writeModes(new Set())
    const test = harness()
    const api = registerPotetoMode(test.ctx)
    assert.equal(test.tools.get(PSTACK_TOOLS[0], test.agent), undefined)
    test.emit('tools/change')
    api.sync('session-root')
    assert.equal(test.tools.active.size, 1)

    const child = delegate('session-child', 'session-root')
    child.tools.onChange = () => test.emit('tools/change')
    test.agents.push(child.agent)
    test.emit('agent/created', { agent: child.agent })
    assert.equal(child.tools.get(PSTACK_TOOLS[0], child.agent), undefined)
    assert.equal(child.tools.active.size, 1)

    const synced = delegate('session-synced', 'session-root')
    synced.tools.onChange = () => test.emit('tools/change')
    test.agents.push(synced.agent)
    api.sync('session-synced')
    assert.equal(synced.tools.get(PSTACK_TOOLS[0], synced.agent), undefined)
    assert.equal(synced.tools.active.size, 1)
    await api.setEnabled('session-root', true)
    assert.notEqual(test.tools.get(PSTACK_TOOLS[0], test.agent), undefined)
    assert.equal(test.tools.get('subagent', test.agent), undefined)
    assert.notEqual(child.tools.get(PSTACK_TOOLS[0], child.agent), undefined)
    assert.equal(child.tools.active.size, 0)
    await api.setEnabled('session-root', false)
    assert.equal(test.tools.get(PSTACK_TOOLS[0], test.agent), undefined)
    assert.equal(child.tools.get(PSTACK_TOOLS[0], child.agent), undefined)
  })

  it('swaps the withheld tools and the prompt section when the switch changes', async () => {
    await writeModes(new Set())
    const test = harness()
    const api = registerPotetoMode(test.ctx)

    await api.setEnabled('session-root', true)
    assert.deepEqual([...readModes()], ['session-root'])
    assert.deepEqual(test.tools.denies.at(-1), [...NATIVE_DELEGATION_TOOLS])
    assert.deepEqual(test.sections, [potetoSkillText()])

    await api.setEnabled('session-root', false)
    assert.deepEqual([...readModes()], [])
    assert.deepEqual(test.tools.denies.at(-1), [...PSTACK_TOOLS])
    assert.deepEqual(test.sections, [])
    assert.equal(test.tools.lifts, 2, 'each change lifts the previous restriction before applying the next')
    const stored = JSON.parse(await readFile(modePath(), 'utf8')) as { version: number; sessions: string[] }
    assert.equal(stored.version, 1)
    assert.deepEqual(stored.sessions, [])
  })

  it('refuses to turn on inside a delegate', async () => {
    await writeModes(new Set())
    const child = delegate('session-child', 'session-root')
    const test = harness(child.agent)
    const api = registerPotetoMode(test.ctx)
    await assert.rejects(api.setEnabled('session-child', true), /not in a delegate/)
    assert.deepEqual([...readModes()], [])
  })

  it('reapplies the restriction when another native tool registers late', async () => {
    await writeModes(new Set(['session-root']))
    const test = harness()
    test.tools.names = ['subagent']
    const api = registerPotetoMode(test.ctx)
    assert.deepEqual(test.tools.denies, [['subagent']])
    await api.setEnabled('session-root', true)
    assert.deepEqual(test.tools.denies.at(-1), ['subagent'])
    test.tools.names.push('subagent_fork')
    test.emit('tools/change', {})
    assert.deepEqual(test.tools.denies.at(-1), ['subagent', 'subagent_fork'])
  })

  it('keeps the prompt section without registering a per-turn reminder', async () => {
    await writeModes(new Set())
    const test = harness()
    const api = registerPotetoMode(test.ctx)
    assert.equal(test.hasListener('agent/pre-step'), false)
    await api.setEnabled('session-root', true)
    assert.deepEqual(test.sections, [potetoSkillText()])
    assert.equal(test.hasListener('agent/pre-step'), false)
    await api.setEnabled('session-root', false)
    assert.equal(test.hasListener('agent/pre-step'), false)
  })

  it('restores the switch for a live session on startup', async () => {
    await writeModes(new Set(['session-root']))
    await writePotetoDefault(false)
    const test = harness()
    registerPotetoMode(test.ctx)
    assert.deepEqual(test.tools.denies, [[...NATIVE_DELEGATION_TOOLS]])
    assert.equal(test.sections.length, 1)
  })

  it('starts a brand-new session in the saved default', async () => {
    await writeModes(new Set())
    await writePotetoDefault(true)
    const test = harness()
    const api = registerPotetoMode(test.ctx)
    assert.equal(api.read('session-root').enabled, false, 'the default does not change a session that already exists')
    await test.emit('agent/created', { agent: test.agent, source: 'startup' })
    assert.equal(api.read('session-root').enabled, true)
    assert.deepEqual([...readModes()], ['session-root'])
    assert.deepEqual(test.tools.denies.at(-1), [...NATIVE_DELEGATION_TOOLS])
    assert.deepEqual(test.sections, [potetoSkillText()])
    assert.notEqual(test.tools.get(PSTACK_TOOLS[0], test.agent), undefined)
  })

  it('keeps a resumed, cleared, or compacted session on its own switch', async () => {
    await writePotetoDefault(true)
    for (const source of ['resume', 'clear', 'compact'] as const) {
      await writeModes(new Set())
      const test = harness()
      const api = registerPotetoMode(test.ctx)
      await test.emit('agent/created', { agent: test.agent, source })
      assert.equal(api.read('session-root').enabled, false, `${source} is not a new session`)
      assert.deepEqual([...readModes()], [])
      assert.deepEqual(test.tools.denies.at(-1), [...PSTACK_TOOLS])
    }
    await writePotetoDefault(false)
  })

  it('leaves a brand-new session off when the default is off', async () => {
    await writeModes(new Set())
    await writePotetoDefault(false)
    const test = harness()
    const api = registerPotetoMode(test.ctx)
    await test.emit('agent/created', { agent: test.agent, source: 'startup' })
    assert.equal(api.read('session-root').enabled, false)
    assert.deepEqual([...readModes()], [])
  })

  it('never turns a delegate on from the default', async () => {
    await writeModes(new Set())
    await writePotetoDefault(true)
    const child = delegate('session-child', 'session-root')
    const test = harness(child.agent)
    registerPotetoMode(test.ctx)
    await test.emit('agent/created', { agent: child.agent, source: 'startup' })
    assert.deepEqual([...readModes()], [])
    assert.deepEqual(child.tools.denies, [[...PSTACK_TOOLS]])
    await writePotetoDefault(false)
  })

  it('turns the workflow off again in a session the default started', async () => {
    await writeModes(new Set())
    await writePotetoDefault(true)
    const test = harness()
    const api = registerPotetoMode(test.ctx)
    await test.emit('agent/created', { agent: test.agent, source: 'startup' })
    await api.setEnabled('session-root', false)
    assert.deepEqual([...readModes()], [])
    assert.deepEqual(test.tools.denies.at(-1), [...PSTACK_TOOLS])
    await writePotetoDefault(false)
  })

  it('keeps both ids when two switches are persisted at once', async () => {
    await writeModes(new Set())
    const test = harness()
    const api = registerPotetoMode(test.ctx)
    await Promise.all([api.setEnabled('session-a', true), api.setEnabled('session-b', true)])
    assert.deepEqual([...readModes()], ['session-a', 'session-b'])
  })

  it('keeps session creation working when the default cannot be persisted', async () => {
    await writePotetoDefault(true)
    // A directory where the mode file goes makes every write fail, while the
    // default file stays readable.
    await rm(modePath(), { recursive: true, force: true })
    await mkdir(modePath())
    try {
      const test = harness()
      const api = registerPotetoMode(test.ctx)
      await test.emit('agent/created', { agent: test.agent, source: 'startup' })
      assert.equal(api.read('session-root').enabled, true, 'the session still starts switched on')
      assert.deepEqual(test.tools.denies.at(-1), [...NATIVE_DELEGATION_TOOLS])
      assert.deepEqual([...readModes()], [], 'nothing reached the disk')
    } finally {
      await rm(modePath(), { recursive: true, force: true })
      await writePotetoDefault(false)
    }
  })

  it('treats a malformed mode file as off', async () => {
    await writeModes(new Set())
    const file = modePath()
    const { writeFile } = await import('node:fs/promises')
    await writeFile(file, '{not json')
    assert.deepEqual([...readModes()], [])
    const test = harness()
    registerPotetoMode(test.ctx)
    assert.deepEqual(test.tools.denies.at(-1), [...PSTACK_TOOLS])
  })

  it('withholds its tools from delegates of a session that never opted in', async () => {
    await writeModes(new Set())
    const child = delegate('session-child', 'session-root')
    const test = harness(child.agent)
    registerPotetoMode(test.ctx)
    assert.deepEqual(child.tools.denies, [[...PSTACK_TOOLS]])
  })

  it('lets delegates inherit an enabled parent without touching the native tools', async () => {
    await writeModes(new Set(['session-root']))
    const child = delegate('session-child', 'session-root')
    const test = harness()
    test.agents.push(child.agent)
    registerPotetoMode(test.ctx)
    assert.deepEqual(test.tools.denies.at(-1), [...NATIVE_DELEGATION_TOOLS])
    assert.deepEqual(child.tools.denies, [])
  })

  it('withdraws the bundled skills from every surface while the switch is off', async () => {
    await writeModes(new Set())
    const test = harness()
    const api = registerPotetoMode(test.ctx)
    const gate = createPotetoSkillGate(test.ctx)
    assert.equal(gate(test.agent), false)
    await api.setEnabled('session-root', true)
    assert.equal(gate(test.agent), true)
    await api.setEnabled('session-root', false)
    assert.equal(gate(test.agent), false)
  })

  it('keeps the authored policy for a lookup that carries no agent', async () => {
    await writeModes(new Set())
    const test = harness()
    const gate = createPotetoSkillGate(test.ctx)
    assert.equal(gate(undefined), true)
    assert.equal(gate({}), true)
    assert.equal(gate({ session: { id: '' } }), true)
  })

  it('lets skill lookups inherit the switch down the delegation chain', async () => {
    await writeModes(new Set(['session-root']))
    const child = delegate('session-child', 'session-root')
    const grandchild = delegate('session-grandchild', 'session-child')
    const unrelated = delegate('session-other', 'nobody')
    const test = harness(child.agent)
    test.agents.push(grandchild.agent, unrelated.agent)
    registerPotetoMode(test.ctx)
    const gate = createPotetoSkillGate(test.ctx)
    assert.equal(gate(child.agent), true)
    assert.equal(gate(grandchild.agent), true)
    assert.equal(gate(unrelated.agent), false)
  })

  it('notifies registrations after the switch changes', async () => {
    await writeModes(new Set())
    const test = harness()
    let changed = 0
    const api = registerPotetoMode(test.ctx, { onChanged: () => { changed += 1 } })
    await api.setEnabled('session-root', true)
    assert.equal(changed, 1)
    await api.setEnabled('session-root', false)
    assert.equal(changed, 2)
  })
})
