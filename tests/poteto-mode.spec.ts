import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Context } from '@deepseek-ai/cordis'
import {
  COMMAND_NAME,
  NATIVE_DELEGATION_TOOLS,
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
  get(name: string): unknown
  restrict(filter: { deny?: readonly string[] }): () => void
}

function fakeTools(names: string[] = [...NATIVE_DELEGATION_TOOLS]): FakeToolRuntime {
  const runtime: FakeToolRuntime = {
    names,
    denies: [],
    lifts: 0,
    get: (name: string) => (runtime.names.includes(name) ? { name } : undefined),
    restrict: (filter: { deny?: readonly string[] }) => {
      runtime.denies.push([...(filter.deny ?? [])])
      return () => {
        runtime.lifts += 1
      }
    },
  }
  return runtime
}

function fakeAgent(id: string, origin: 'user' | 'subagent', services: Record<string, unknown>): Agent {
  return {
    session: { id, header: { origin } },
    ctx: { get: (name: string) => services[name] },
  } as unknown as Agent
}

interface Harness {
  ctx: Context
  agent: Agent
  tools: FakeToolRuntime
  sections: string[]
  invoke(rawInput: string, agent?: Agent): Promise<{ kind: string; text?: string }>
  emit(event: string, payload?: unknown): void
  agents: Agent[]
}

function harness(services: Record<string, unknown> = {}, agent?: Agent): Harness {
  const registered: Array<{ name: string; handler: (invocation: { agent: Agent; rawInput: string }) => Promise<{ kind: string; text?: string }> }> = []
  const listeners = new Map<string, (payload?: unknown) => void>()
  const tools = fakeTools()
  const sections: string[] = []
  const prompt = {
    section: (section: { name: string; text: string }) => {
      sections.push(section.text)
      return () => {
        sections.pop()
      }
    },
  }
  const primary = agent ?? fakeAgent('session-root', 'user', { tools, systemPrompt: prompt, ...services })
  const agents = [primary]
  const ctx = {
    get: (name: string) => ({ commands: { register: (definition: never) => (registered.push(definition as never), () => {}) }, agents: { list: () => agents }, ...services })[name as never],
    on: (event: string, handler: (payload?: unknown) => void) => {
      listeners.set(event, handler)
      return () => {}
    },
  } as unknown as Context
  return {
    ctx,
    agent: primary,
    tools,
    sections,
    agents,
    async invoke(rawInput, target) {
      assert.equal(registered.length, 1)
      assert.equal(registered[0].name, COMMAND_NAME)
      return registered[0].handler({ agent: target ?? primary, rawInput })
    },
    emit(event, payload) {
      listeners.get(event)?.(payload)
    },
  }
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

  it('denies the native delegation tools and records the session when turned on', async () => {
    const test = harness()
    registerPotetoMode(test.ctx)
    const result = await test.invoke('on')
    assert.equal(result.kind, 'success')
    assert.deepEqual(test.tools.denies, [[...NATIVE_DELEGATION_TOOLS]])
    assert.deepEqual([...readModes()], ['session-root'])
    const stored = JSON.parse(await readFile(modePath(), 'utf8')) as { version: number; sessions: string[] }
    assert.equal(stored.version, 1)
    assert.deepEqual(stored.sessions, ['session-root'])
  })

  it('adds the poteto-mode text to the session prompt', async () => {
    const test = harness()
    registerPotetoMode(test.ctx)
    await test.invoke('on')
    assert.equal(test.sections.length, 1)
    assert.match(test.sections[0], /poteto-mode/)
    assert.equal(test.sections[0], potetoSkillText())
  })

  it('lifts the restriction and forgets the session when turned off', async () => {
    const test = harness()
    registerPotetoMode(test.ctx)
    await test.invoke('on')
    const result = await test.invoke('off')
    assert.equal(result.kind, 'success')
    assert.equal(test.tools.lifts, 1)
    assert.deepEqual(test.sections, [])
    assert.deepEqual([...readModes()], [])
  })

  it('reports status without changing state', async () => {
    const test = harness()
    registerPotetoMode(test.ctx)
    assert.match((await test.invoke('status')).text ?? '', /off/)
    await test.invoke('on')
    assert.match((await test.invoke('status')).text ?? '', /on/)
    assert.deepEqual([...readModes()], ['session-root'])
  })

  it('refuses to turn on inside a delegate', async () => {
    await writeModes(new Set())
    const delegate = fakeAgent('session-child', 'subagent', { tools: fakeTools(), systemPrompt: { section: () => () => {} } })
    const test = harness({}, delegate)
    registerPotetoMode(test.ctx)
    const result = await test.invoke('on')
    assert.equal(result.kind, 'error')
    assert.deepEqual([...readModes()], [])
  })

  it('reapplies the restriction when a native tool registers late', async () => {
    const test = harness()
    registerPotetoMode(test.ctx)
    await test.invoke('on')
    test.emit('tools/change', {})
    assert.equal(test.tools.denies.length, 1, 'already-denied tools are not restricted twice')
    test.tools.names.push('subagent-fork-2')
    test.emit('tools/change', {})
    assert.equal(test.tools.denies.length, 1, 'unknown names are ignored')
  })

  it('restores the switch for a live session on startup', async () => {
    await writeModes(new Set(['session-root']))
    const test = harness()
    registerPotetoMode(test.ctx)
    assert.deepEqual(test.tools.denies, [[...NATIVE_DELEGATION_TOOLS]])
    assert.equal(test.sections.length, 1)
  })

  it('treats a malformed mode file as off', async () => {
    await writeModes(new Set())
    const file = modePath()
    const { writeFile } = await import('node:fs/promises')
    await writeFile(file, '{not json')
    assert.deepEqual([...readModes()], [])
  })
})
