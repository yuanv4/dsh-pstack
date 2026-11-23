/**
 * Session-scoped poteto switch, modelled on l246804/dsh-pstack's poteto toggle.
 *
 * Skill text alone cannot stop a model from calling the native `subagent` tool,
 * which bypasses the role mapping entirely. So while the switch is on for a
 * session, this plugin denies the native delegation tools for that agent and puts
 * the poteto-mode skill text into that session's system prompt. Every delegation
 * then has to go through `pstack_spawn`, where the overlay decides the route.
 *
 * The same state is reachable three ways: `/pstack-poteto-mode`, the session
 * header toggle in the Web client, and `$DSH_HOME/pstack-poteto.json`.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage, type UserMessage } from '@deepseek-ai/dsh-llm'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { parseSkillMarkdown } from './frontmatter.ts'
import { resolveDshHome } from './home.ts'

export const COMMAND_NAME = 'pstack-poteto-mode'
export const MODE_FILENAME = 'pstack-poteto.json'
/** Native delegation tools that would bypass the role mapping. */
export const NATIVE_DELEGATION_TOOLS = ['subagent', 'subagent_fork'] as const
const SECTION_NAME = 'pstack:poteto-workflow'
const SECTION_ORDER = 10
/** One-line reinforcement appended to every new user turn while the switch is on. */
const REMINDER = 'Poteto workflow is active. Follow the poteto-mode instructions in the system prompt strictly, and do not skip any required step or rule it names. Delegate only through pstack_spawn so the role mapping decides the route.'

interface ModeFile {
  version: 1
  sessions: string[]
}

export interface PotetoState {
  readonly enabled: boolean
  /** Native tools currently denied for the live agent, in registration order. */
  readonly denied: string[]
}

export interface PotetoSwitch {
  read(sessionId: string): PotetoState
  setEnabled(sessionId: string, enabled: boolean): Promise<PotetoState>
  /** Reapply the restriction and prompt section for a live agent. */
  sync(sessionId: string): void
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

interface AgentRuntime {
  list(): Agent[]
  get(sessionId: string): Agent | undefined
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

type PreStepDecision = { readonly kind: 'reject' } | { readonly kind: 'enter'; readonly messages: UserMessage[]; readonly startsRequestSeries?: true }

const sessionIdOf = (agent: Agent): string => String(agent.session.id)
const isRootAgent = (agent: Agent): boolean => agent.session.header.origin !== 'subagent'

interface Applied {
  tools: Set<string>
  section: (() => void) | undefined
  disposers: Array<() => void>
}

/**
 * Install the switch and its command. Call once from `apply`.
 *
 * Nothing is registered when the host does not expose the commands service,
 * which keeps unit tests and headless hosts working.
 */
export function registerPotetoMode(ctx: Context): PotetoSwitch | undefined {
  const commands = ctx.get('commands') as CommandRuntime | undefined
  if (commands === undefined) return undefined
  const modes = readModes()
  const applied = new Map<Agent, Applied>()
  const remindedFor = new WeakMap<Agent, unknown>()

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

  const agentOf = (sessionId: string): Agent | undefined => (ctx.get('agents') as AgentRuntime | undefined)?.get(sessionId)

  const stateOf = (sessionId: string): PotetoState => {
    const agent = agentOf(sessionId)
    return {
      enabled: modes.has(sessionId),
      denied: agent === undefined ? [] : [...(applied.get(agent)?.tools ?? [])],
    }
  }

  const sync = (sessionId: string): void => {
    if (!modes.has(sessionId)) return
    const agent = agentOf(sessionId)
    if (agent !== undefined) applyTo(agent)
  }

  const setEnabled = async (sessionId: string, enabled: boolean): Promise<PotetoState> => {
    const agent = agentOf(sessionId)
    if (enabled && agent !== undefined && !isRootAgent(agent)) {
      throw new Error('the poteto switch is only available in the session that runs the workflow, not in a delegate')
    }
    if (enabled) {
      modes.add(sessionId)
      await writeModes(modes)
      if (agent !== undefined) applyTo(agent)
    } else {
      modes.delete(sessionId)
      await writeModes(modes)
      if (agent !== undefined) clear(agent)
    }
    return stateOf(sessionId)
  }

  const switchApi: PotetoSwitch = { read: stateOf, setEnabled, sync }

  commands.register({
    name: COMMAND_NAME,
    description: 'Turn the poteto workflow on or off for this session. While on, the native subagent tools are disabled so delegation has to use pstack_spawn and its role mapping.',
    input: { hint: 'on | off | status' },
    handler: async ({ agent, rawInput }) => {
      const sessionId = sessionIdOf(agent)
      const argument = (rawInput.trim().split(/\s+/)[0] ?? '').toLowerCase()
      if (argument === '' || argument === 'status') {
        const state = stateOf(sessionId)
        return {
          kind: 'success',
          text: state.enabled
            ? `poteto workflow: on. Denied here: ${state.denied.length === 0 ? 'nothing yet' : state.denied.join(', ')}.`
            : 'poteto workflow: off. The native subagent tools are available.',
        }
      }
      if (argument === 'on' || argument === 'off') {
        try {
          const state = await setEnabled(sessionId, argument === 'on')
          return {
            kind: 'success',
            text: state.enabled
              ? `poteto workflow: on. The native subagent tools are now denied for this session, so delegation goes through pstack_spawn and the role mapping in $DSH_HOME/pstack-dsh.json. The poteto-mode instructions joined the system prompt.`
              : 'poteto workflow: off. The native subagent tools are available again.',
          }
        } catch (error) {
          return { kind: 'error', text: error instanceof Error ? error.message : 'switch failed' }
        }
      }
      return { kind: 'error', text: 'Usage: /pstack-poteto-mode on | off | status' }
    },
  })

  ctx.on('agent/created', (payload: AgentCreatedPayload) => {
    if (modes.has(sessionIdOf(payload.agent))) applyTo(payload.agent)
  })

  // A system prompt section is assembled for every step, so it never expires.
  // The reminder exists to counter drift: one short line per new user turn.
  ctx.on('agent/pre-step', async (
    payload: { agent: Agent; messages: UserMessage[] },
    next: () => Promise<PreStepDecision>,
  ): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision.kind === 'reject') return decision
    if (!modes.has(sessionIdOf(payload.agent))) return decision
    applyTo(payload.agent)
    const latest = payload.messages.filter(message => message.source?.kind === 'user').at(-1)
    if (latest === undefined || remindedFor.get(payload.agent) === latest.id) return decision
    remindedFor.set(payload.agent, latest.id)
    const reminder = createUserMessage({
      content: [{ type: 'text', text: REMINDER }],
      source: { kind: 'system-prompt' },
    })
    return { ...decision, messages: [...decision.messages, reminder] }
  }, { prepend: true })

  ctx.on('tools/change', () => {
    for (const agent of (ctx.get('agents') as AgentRuntime | undefined)?.list() ?? []) {
      if (modes.has(sessionIdOf(agent))) applyTo(agent)
    }
  })

  // Agents created before this plugin applied never saw agent/created.
  for (const agent of (ctx.get('agents') as AgentRuntime | undefined)?.list() ?? []) {
    if (modes.has(sessionIdOf(agent))) applyTo(agent)
  }

  return switchApi
}
