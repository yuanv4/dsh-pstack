/**
 * Executable check of the built bundle: `/pstack-poteto-mode on` must deny the
 * native delegation tools for the calling session and persist the switch.
 */
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

if (!process.env.DSH_INSTALL_DIR) throw new Error('Run from DSH or set DSH_INSTALL_DIR')
const anchor = pathToFileURL(join(process.env.DSH_INSTALL_DIR, 'package.json')).href
registerHooks({
  resolve(specifier, context, next) {
    return next(specifier, context, specifier.startsWith('@deepseek-ai/') ? { ...context, parentURL: anchor } : context)
  },
})

const home = await mkdtemp(join(tmpdir(), 'pstack-poteto-check-'))
const previousHome = process.env.DSH_HOME
process.env.DSH_HOME = home
try {
  const { apply } = await import(new URL('./lib/index.js', import.meta.url).href)

  const registered = []
  const listeners = new Map()
  const denies = []
  let promptSections = 0
  const tools = {
    get: name => (['subagent', 'subagent_fork'].includes(name) ? { name } : undefined),
    restrict: filter => {
      denies.push([...(filter.deny ?? [])])
      return () => {}
    },
  }
  const agent = {
    session: { id: 'live-session', header: { origin: 'user' } },
    ctx: {
      get: name => ({ tools, systemPrompt: { section: () => (promptSections += 1, () => {}) } })[name],
    },
  }
  const ctx = {
    get: name => ({
      commands: { register: definition => (registered.push(definition), () => {}) },
      agents: { list: () => [agent], get: id => (String(agent.session.id) === String(id) ? agent : undefined) },
      llm: { listProviders: () => [], listModels: async () => [] },
      subagents: { startActivation: async () => ({}) },
    })[name],
    on: (event, handler) => {
      listeners.set(event, handler)
      return () => {}
    },
    inject: () => {},
    skills: { registerProvider: () => {} },
    tools: { register: () => {} },
  }

  apply(ctx)
  const command = registered.find(entry => entry.name === 'pstack-poteto-mode')
  assert.ok(command, 'the switch command registers from the built bundle')
  assert.match(command.description, /native subagent/)

  const on = await command.handler({ agent, rawInput: ' on ' })
  assert.equal(on.kind, 'success')
  assert.deepEqual(denies, [['subagent', 'subagent_fork']])
  assert.equal(promptSections, 1)

  const preStep = listeners.get('agent/pre-step')
  assert.ok(preStep, 'the switch registers the per-turn reminder hook')
  const decision = await preStep({ agent, messages: [{ id: 'user-1', source: { kind: 'user' } }] }, async () => ({ kind: 'enter', messages: [] }))
  assert.equal(decision.messages.length, 1)
  assert.match(JSON.stringify(decision.messages[0]), /Poteto workflow is active/)

  const status = await command.handler({ agent, rawInput: 'status' })
  assert.match(status.text, /on/)

  const off = await command.handler({ agent, rawInput: 'off' })
  assert.equal(off.kind, 'success')

  const { readModes } = await import(new URL('./lib/index.js', import.meta.url).href)
  assert.equal(readModes, undefined, 'internal helpers stay out of the public surface')
  console.log('PASS: poteto switch denies native delegation, injects the skill, reminds each turn, and toggles off')
} finally {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  if (home.startsWith(join(tmpdir(), 'pstack-poteto-check-'))) await rm(home, { recursive: true, force: true })
}
