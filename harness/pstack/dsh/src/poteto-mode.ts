/**
 * Session-scoped poteto switch, modelled on l246804/dsh-pstack's poteto toggle.
 *
 * The switch owns this plugin's whole per-session surface. While it is on for a
 * session, the bundled tools stay available, the native delegation tools are
 * denied (so every delegation goes through `pstack_spawn` and the overlay route),
 * the poteto-mode text joins the session prompt, and the bundled skills are
 * advertised to the model. While it is off, the opposite holds: the native
 * delegation tools are left alone and every bundled tool and skill is withheld.
 *
 * The switch is controlled from the model menu row in the Web client and stored
 * per session in `$DSH_HOME/pstack-poteto.json`. The saved default in
 * `$DSH_HOME/pstack-settings.json` only decides what a brand-new session starts
 * with; it never changes a session that is already open.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { Agent, SessionStartSource } from '@deepseek-ai/dsh-agent'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { parseSkillMarkdown } from './frontmatter.ts'
import { resolveDshHome } from './home.ts'
import { PSTACK_TOOLS } from './ids.ts'
import { readPotetoDefault } from './poteto-default.ts'

export const MODE_FILENAME = 'pstack-poteto.json'
/** Native delegation tools that would bypass the role mapping. */
export const NATIVE_DELEGATION_TOOLS = ['subagent', 'subagent_fork'] as const
const SECTION_NAME = 'pstack:poteto-workflow'
const SECTION_ORDER = 10

interface ModeFile {
  version: 1
  sessions: string[]
}

export interface PotetoState {
  readonly enabled: boolean
  /** Tools currently denied for the live agent, in registration order. */
  readonly denied: string[]
}

export interface PotetoSwitch {
  read(sessionId: string): PotetoState
  setEnabled(sessionId: string, enabled: boolean): Promise<PotetoState>
  /** Reapply the tool surface, prompt section, and skill availability for a live agent. */
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
    const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'generated', 'skills', 'poteto-mode', 'SKILL.md')
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

/** A session id carried by the viewing scope of a model-facing skill lookup. */
function sessionIdOfScope(scope: unknown): string | undefined {
  const session = (scope as { session?: { id?: unknown } } | undefined)?.session
  const id = session?.id
  return typeof id === 'string' && id.length > 0 ? id : undefined
}

/**
 * Follow the delegation chain to the switch.
 *
 * A delegate runs inside the workflow of the session that started it, so an
 * enabled ancestor enables the child. Walking `parentSession` also protects the
 * chain against a malformed or cyclic header: each id is visited once.
 */
function isSessionEnabled(ctx: Context, sessions: ReadonlySet<string>, sessionId: string): boolean {
  const agents = ctx.get('agents') as AgentRuntime | undefined
  const seen = new Set<string>()
  let cursor: string | undefined = sessionId
  while (cursor !== undefined && !seen.has(cursor)) {
    if (sessions.has(cursor)) return true
    seen.add(cursor)
    cursor = agents?.get(cursor)?.session.header.parentSession
  }
  return false
}

/**
 * Build the gate that keeps the bundled skills out of sessions that never
 * opted in.
 *
 * DSH advertises every skill whose invocation policy allows it, so without this
 * gate the whole poteto pack reaches the model catalog and the `/` menu of any
 * session that merely has the plugin installed. The switch owns that surface:
 * while it is off the provider reports every bundled skill as neither
 * model-invocable nor user-invocable, which removes it from both surfaces and
 * rejects a direct `skill` load.
 *
 * A lookup with no agent scope has no session switch to consult, so it keeps the
 * authored policy.
 */
export function createPotetoSkillGate(ctx: Context): (scope: unknown) => boolean {
  return (scope) => {
    const sessionId = sessionIdOfScope(scope)
    return sessionId === undefined || isSessionEnabled(ctx, readModes(), sessionId)
  }
}

/** Follow changes that other registrations must reflect, such as catalog invalidation. */
export interface PotetoModeHooks {
  /** Called after the persisted switch state changed. */
  onChanged?(): void
}

interface AgentCreatedPayload {
  readonly agent: Agent
  /** Why the session lifecycle began: `startup` creates, while `resume`, `clear`, and `compact` continue a session. */
  readonly source?: SessionStartSource
}

const sessionIdOf = (agent: Agent): string => String(agent.session.id)
const isRootAgent = (agent: Agent): boolean => agent.session.header.origin !== 'subagent'

/** One agent's applied surface, diffed on every reconcile pass. */
interface Applied {
  /** Tool names the single current restriction denies. */
  denied: Set<string>
  toolDisposers: Array<() => void>
  section: (() => void) | undefined
}

/**
 * Tools the switch withholds for one agent.
 *
 * Off withholds this plugin's own tools for the session and every delegate it
 * started. On withholds the native delegation tools in the root session, so
 * `pstack_spawn` is the only delegation path left; a delegate keeps the native
 * tools it already had.
 */
function withheldTools(enabled: boolean, root: boolean): readonly string[] {
  if (!enabled) return PSTACK_TOOLS
  return root ? NATIVE_DELEGATION_TOOLS : []
}

function sameDenials(denied: ReadonlySet<string>, wanted: readonly string[]): boolean {
  return denied.size === wanted.length && wanted.every(name => denied.has(name))
}

/**
 * Install the switch. Call once from `apply`.
 *
 * The per-session switch is reached from the Web client's model-menu row, which
 * talks to `registerPstackPotetoRoutes`, and its state lives in
 * `$DSH_HOME/pstack-poteto.json`. A session lifecycle that begins at `startup`
 * also reads the default in `$DSH_HOME/pstack-settings.json`, so a new session
 * can start switched on without a per-session request.
 */
export function registerPotetoMode(ctx: Context, hooks: PotetoModeHooks = {}): PotetoSwitch {
  const modes = readModes()
  const applied = new Map<Agent, Applied>()
  const agentsRuntime = (): AgentRuntime | undefined => ctx.get('agents') as AgentRuntime | undefined
  const agentOf = (sessionId: string): Agent | undefined => agentsRuntime()?.get(sessionId)

  /**
   * Persist the whole set, one write at a time.
   *
   * Two writers exist: the model-menu switch and a new session's default. Each
   * rewrites the file from the live set and renames it into place, so an
   * unordered pair of renames can leave the earlier snapshot on disk and lose
   * the other session's id. Chaining the writes makes the last one the newest
   * set; the set is read when its turn comes, so a queued write sees every
   * change made before it ran. A failed write rejects its own caller and does
   * not stop the ones behind it.
   */
  let writes: Promise<void> = Promise.resolve()
  const persistModes = (): Promise<void> => {
    const next = writes.then(() => writeModes(modes), () => writeModes(modes))
    writes = next.then(() => undefined, () => undefined)
    return next
  }

  /**
   * Converge one agent's surface on its switch state. Re-running is free and
   * idempotent: each piece is compared before anything is lifted or added.
   */
  const applyTo = (agent: Agent): void => {
    const enabled = isSessionEnabled(ctx, modes, sessionIdOf(agent))
    const root = isRootAgent(agent)
    const record = applied.get(agent) ?? { denied: new Set<string>(), toolDisposers: [], section: undefined }
    applied.set(agent, record)

    const tools = agent.ctx.get('tools') as ToolRuntime | undefined
    if (tools !== undefined) {
      // The unscoped lookup sees global registrations without this agent's mask.
      // Scoped registrations cannot be denied by tools.restrict().
      const wanted = withheldTools(enabled, root).filter(name => tools.get(name) !== undefined)
      if (!sameDenials(record.denied, wanted)) {
        for (const dispose of record.toolDisposers.splice(0)) {
          try {
            dispose()
          } catch {
            // Lifting twice is harmless.
          }
        }
        record.denied.clear()
        if (wanted.length > 0) {
          try {
            record.toolDisposers.push(tools.restrict({ deny: wanted }))
            for (const name of wanted) record.denied.add(name)
          } catch {
            // A tool crossed out of the registry between the lookup and the call;
            // the next tools/change reconciles it.
          }
        }
      }
    }

    if (enabled && root) {
      if (record.section === undefined) {
        const prompt = agent.ctx.get('systemPrompt') as PromptRuntime | undefined
        const text = potetoSkillText()
        if (prompt !== undefined && text !== '') {
          try {
            record.section = prompt.section({ name: SECTION_NAME, order: SECTION_ORDER, text, interpolate: false })
          } catch {
            // Duplicate registration means another pass already added it.
          }
        }
      }
    } else if (record.section !== undefined) {
      try {
        record.section()
      } catch {
        // Lifting twice is harmless.
      }
      record.section = undefined
    }
  }

  /**
   * Converge every live agent; a toggle can change the state of its delegates too.
   *
   * `applyTo` calls `tools.restrict()`/`dispose()`, both of which synchronously
   * emit `tools/change`, whose listener is this same reconcile. The re-entry
   * guard drops those nested passes; the outer pass finishes applying the
   * requested agent or the complete live set before it returns.
   */
  let reconciling = false
  const reconcile = (target?: Agent): void => {
    if (reconciling) return
    reconciling = true
    try {
      for (const agent of target === undefined ? agentsRuntime()?.list() ?? [] : [target]) applyTo(agent)
    } finally {
      reconciling = false
    }
  }

  const stateOf = (sessionId: string): PotetoState => {
    const agent = agentOf(sessionId)
    return {
      enabled: modes.has(sessionId),
      denied: agent === undefined ? [] : [...(applied.get(agent)?.denied ?? [])],
    }
  }

  const sync = (sessionId: string): void => {
    const agent = agentOf(sessionId)
    if (agent !== undefined) reconcile(agent)
  }

  const setEnabled = async (sessionId: string, enabled: boolean): Promise<PotetoState> => {
    const agent = agentOf(sessionId)
    if (enabled && agent !== undefined && !isRootAgent(agent)) {
      throw new Error('the poteto switch is only available in the session that runs the workflow, not in a delegate')
    }
    if (enabled) modes.add(sessionId)
    else modes.delete(sessionId)
    await persistModes()
    reconcile()
    hooks.onChanged?.()
    return stateOf(sessionId)
  }

  const switchApi: PotetoSwitch = { read: stateOf, setEnabled, sync }

  /**
   * Start a brand-new session in the saved default state.
   *
   * Only a lifecycle that begins at `startup` is new; `resume`, `clear`, and
   * `compact` continue a session whose switch the user already saw. The mode is
   * added in memory before the agent's surface is reconciled, so the first
   * prompt already has the switched-on tools. A session created under the
   * default must still be on after a restart, so the write is awaited, but a
   * failed write must not fail session creation.
   */
  const applyDefault = (agent: Agent): Promise<undefined> | undefined => {
    if (!isRootAgent(agent) || !readPotetoDefault()) return undefined
    const sessionId = sessionIdOf(agent)
    if (modes.has(sessionId)) return undefined
    modes.add(sessionId)
    return persistModes().then(() => undefined, () => undefined)
  }

  ctx.on('agent/created', (payload: AgentCreatedPayload) => {
    const persisted = payload.source === 'startup' ? applyDefault(payload.agent) : undefined
    reconcile(payload.agent)
    return persisted
  })

  ctx.on('agent/disposed', (payload: AgentCreatedPayload) => {
    applied.delete(payload.agent)
  })

  ctx.on('tools/change', () => {
    reconcile()
  })

  // Agents created before this plugin applied never saw agent/created.
  reconcile()

  return switchApi
}
