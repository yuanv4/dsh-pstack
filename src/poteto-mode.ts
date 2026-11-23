/**
 * Session-scoped poteto switch, modelled on l246804/dsh-pstack's poteto toggle.
 *
 * Skill text alone cannot stop a model from calling the native `subagent` tool,
 * which bypasses the role mapping entirely. So while the switch is on for a
 * session, this plugin denies the native delegation tools for that agent and puts
 * the poteto-mode skill text into that session's system prompt. Every delegation
 * then has to go through `pstack_spawn`, where the overlay decides the route.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { parseSkillMarkdown } from './frontmatter.ts'
import { resolveDshHome } from './home.ts'

export const COMMAND_NAME = 'pstack-poteto-mode'
export const MODE_FILENAME = 'pstack-poteto.json'
/** Native delegation tools that would bypass the role mapping. */
export const NATIVE_DELEGATION_TOOLS = ['subagent', 'subagent_fork'] as const
const SECTION_NAME = 'pstack:poteto-workflow'
const SECTION_ORDER = 10

interface ModeFile {
  version: 1
  sessions: string[]
}

export function modePath(dshHome = resolveDshHome()): string {
  return join(dshHome, MODE_FILENAME)
}

/** Sessions with the switch on. A missing or malformed file means none. */
export function readModes(dshHome = resolveDshHome()): Set<string> {
  try {
    const parsed = JSON.parse(readFileSync(modePath(dshHome), 'utf8')) as Partial<ModeFile>
    if (parsed.version !== 1 || !Array.isArray(parsed.sessions)) return new Set()
    return new Set(parsed.sessions.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

export async function writeModes(sessions: Set<string>, dshHome = resolveDshHome()): Promise<void> {
  const body = `${JSON.stringify({ version: 1, sessions: [...sessions].sort() }, null, 2)}\n`
  await writeFileAtomic(modePath(dshHome), body, { mode: 0o600, dirMode: 0o700 })
}

/** The poteto-mode skill body, without frontmatter. Empty when the file is missing. */
export function potetoSkillText(): string {
  try {
    const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'poteto-mode', 'SKILL.md')
    return parseSkillMarkdown(readFileSync(file, 'utf8'), 'poteto-mode')?.content ?? ''
  } catch {
    return ''
  }
}

interface ToolRuntime {
  get(name: string, scope?: unknown): unknown
  restrict(filter: { deny?: readonly string[]; allow?: readonly string[] }): () => void
}

interface PromptRuntime {
  section(section: { name: string; order: number; text: string; interpolate?: boolean }): () => void
}

interface CommandInvocation {
  readonly agent: Agent
  readonly rawInput: string
}

interface CommandRuntime {
  register(definition: {
    name: string
    description: string
    input?: { hint: string }
    handler: (invocation: CommandInvocation) => { kind: 'success'; text?: string } | { kind: 'error'; text: string } | Promise<{ kind: 'success'; text?: string } | { kind: 'error'; text: string }>
  }): () => void
}

interface AgentCreatedPayload {
  readonly agent: Agent
}

interface AgentRuntime {
  list(): Agent[]
}

const sessionIdOf = (agent: Agent): string => String(agent.session.id)
const isRootAgent = (agent: Agent): boolean => agent.session.header.origin !== 'subagent'

/**
 * Install the switch. Call once from `apply`.
 *
 * The command, the agent hooks, and the persistence all live here so the plugin
 * keeps a single owner for session state. Nothing is registered when the host
 * does not expose the commands service, which keeps unit tests and headless
 * hosts working.
 */
export function registerPotetoMode(ctx: Context): void {
  const commands = ctx.get('commands') as CommandRuntime | undefined
  if (commands === undefined) return
  const modes = readModes()
  const applied = new Map<Agent, { tools: Set<string>; section: (() => void) | undefined; disposers: Array<() => void> }>()

  const applyTo = (agent: Agent): void => {
    if (!isRootAgent(agent)) return
    const record = applied.get(agent) ?? { tools: new Set<string>(), section: undefined, disposers: [] }
    applied.set(agent, record)

    const tools = agent.ctx.get('tools') as ToolRuntime | undefined
    const missing = tools === undefined ? [] : NATIVE_DELEGATION_TOOLS.filter(name => !record.tools.has(name) && tools.get(name, agent) !== undefined)
    if (tools !== undefined && missing.length > 0) {
      try {
        record.disposers.push(tools.restrict({ deny: missing }))
        for (const name of missing) record.tools.add(name)
      } catch {
        // The tool crossed out of the registry between the lookup and the call;
        // the next tools/change reconciles it.
      }
    }

    if (record.section === undefined) {
      const prompt = agent.ctx.get('systemPrompt') as PromptRuntime | undefined
      const text = potetoSkillText()
      if (prompt !== undefined && text !== '') {
        try {
          const dispose = prompt.section({ name: SECTION_NAME, order: SECTION_ORDER, text, interpolate: false })
          record.section = dispose
          record.disposers.push(dispose)
        } catch {
          // Duplicate registration means another pass already added it.
        }
      }
    }
  }

  const clear = (agent: Agent): void => {
    const record = applied.get(agent)
    if (record === undefined) return
    for (const dispose of record.disposers.reverse()) {
      try {
        dispose()
      } catch {
        // Lifting twice is harmless.
      }
    }
    applied.delete(agent)
  }

  const statusOf = (agent: Agent): string => {
    const on = modes.has(sessionIdOf(agent))
    const record = applied.get(agent)
    const denied = record === undefined ? [] : [...record.tools]
    return on
      ? `poteto workflow: on. Denied here: ${denied.length === 0 ? 'nothing yet' : denied.join(', ')}.`
      : 'poteto workflow: off. The native subagent tools are available.'
  }

  commands.register({
    name: COMMAND_NAME,
    description: 'Turn the poteto workflow on or off for this session. While on, the native subagent tools are disabled so delegation has to use pstack_spawn and its role mapping.',
    input: { hint: 'on | off | status' },
    handler: async ({ agent, rawInput }) => {
      const argument = (rawInput.trim().split(/\s+/)[0] ?? '').toLowerCase()
      if (argument === '' || argument === 'status') {
        return { kind: 'success', text: statusOf(agent) }
      }
      if (argument === 'on') {
        if (!isRootAgent(agent)) return { kind: 'error', text: 'The poteto switch is only available in the session that runs the workflow, not in a delegate.' }
        if (!modes.has(sessionIdOf(agent))) {
          modes.add(sessionIdOf(agent))
          await writeModes(modes)
        }
        applyTo(agent)
        return {
          kind: 'success',
          text: `poteto workflow: on. The native subagent tools are now denied for this session, so delegation goes through pstack_spawn and the role mapping in $DSH_HOME/pstack-dsh.json. The poteto-mode instructions joined the system prompt.`,
        }
      }
      if (argument === 'off') {
        modes.delete(sessionIdOf(agent))
        await writeModes(modes)
        clear(agent)
        return { kind: 'success', text: 'poteto workflow: off. The native subagent tools are available again.' }
      }
      return { kind: 'error', text: 'Usage: /pstack-poteto-mode on | off | status' }
    },
  })

  ctx.on('agent/created', (payload: AgentCreatedPayload) => {
    if (modes.has(sessionIdOf(payload.agent))) applyTo(payload.agent)
  })

  ctx.on('tools/change', () => {
    const agents = ctx.get('agents') as AgentRuntime | undefined
    for (const agent of agents?.list() ?? []) {
      if (modes.has(sessionIdOf(agent))) applyTo(agent)
    }
  })

  // Agents created before this plugin applied never saw agent/created.
  const agents = ctx.get('agents') as AgentRuntime | undefined
  for (const agent of agents?.list() ?? []) {
    if (modes.has(sessionIdOf(agent))) applyTo(agent)
  }
}
