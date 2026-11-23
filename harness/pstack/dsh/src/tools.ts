import type { Agent } from '@deepseek-ai/dsh-agent'
import { ReasoningEffortId, type ContentBlock } from '@deepseek-ai/dsh-llm'
import type { SubagentRuntime } from '@deepseek-ai/dsh-subagent'
import type { ParameterSchemaSpec } from '@deepseek-ai/dsh-tools'
import type { CatalogHost, LiveRoute } from './catalog.ts'
import { buildCatalog } from './catalog.ts'
import {
  parseOverlay,
  readOverlay,
  validateOverlayAgainstCatalog,
  writeOverlay,
  type Overlay,
} from './overlay.ts'
import { resolveDshHome } from './home.ts'
import { loadPersona } from './persona.ts'
import { resolveSpawn } from './spawn.ts'
import { normalizeRole } from './roles.ts'
import {
  SPAWN_PROVIDER,
  TOOL_CATALOG,
  TOOL_INTERRUPT,
  TOOL_OVERLAY_READ,
  TOOL_OVERLAY_WRITE,
  TOOL_SPAWN,
} from './ids.ts'

export interface ToolDefinition {
  name: string
  description: string
  parameters: ParameterSchemaSpec
  execute(args: Record<string, unknown>, exec: { signal?: AbortSignal; agent?: Agent }): Promise<unknown>
}

export interface ToolHost extends CatalogHost {
  subagents?: Pick<SubagentRuntime, 'startActivation' | 'resolveName' | 'interrupt'>
  spawnProvider?: string
}

function textPrompt(prompt: string): ContentBlock[] {
  return [{ type: 'text', text: prompt }]
}

export function catalogTool(host: ToolHost): ToolDefinition {
  return {
    name: TOOL_CATALOG,
    description:
      'List the provider/model pairs DSH exposes for pstack, along with their supported reasoning efforts.',
    parameters: {},
    async execute(_args, exec) {
      return buildCatalog(host, exec.signal)
    },
  }
}

export function overlayReadTool(host: ToolHost): ToolDefinition {
  return {
    name: TOOL_OVERLAY_READ,
    description: 'Read $DSH_HOME/pstack-dsh.json. Missing file means inherit the parent conversation for every role.',
    parameters: {},
    async execute() {
      const current = await readOverlay(host.dshHome ?? resolveDshHome(host.env))
      return {
        path: current.path,
        missing: current.missing,
        overlay: current.overlay,
      }
    },
  }
}

export function overlayWriteTool(host: ToolHost): ToolDefinition {
  return {
    name: TOOL_OVERLAY_WRITE,
    description:
      'Write $DSH_HOME/pstack-dsh.json after validating every provider/model/effort against pstack_catalog. inherit-parent is stored as inherit: true with empty routes.',
    parameters: {
      overlay: {
        type: 'json',
        required: true,
        description: 'Full overlay object { version: 1, roles: { <role>: { inherit, routes } } }',
      },
    },
    async execute(args) {
      const overlay = typeof args.overlay === 'string'
        ? parseOverlay(args.overlay)
        : parseOverlay(JSON.stringify(args.overlay))
      const catalog = await buildCatalog(host)
      const errors = validateOverlayAgainstCatalog(overlay, catalog.routes)
      if (errors.length > 0) {
        throw new Error(`overlay rejected against live catalog:\n${errors.join('\n')}`)
      }
      const path = await writeOverlay(overlay, host.dshHome ?? resolveDshHome(host.env))
      return { path, overlay }
    },
  }
}

export function spawnTool(host: ToolHost): ToolDefinition {
  return {
    name: TOOL_SPAWN,
    description:
      'Delegate a pstack role to a DSH subagent via ctx.subagents (spawn provider). Send description, prompt, role, and optional run_in_background. The role line in $DSH_HOME/pstack-dsh.json supplies the default route; send model or reasoning_effort only to adjust one job away from it. A role with no line inherits this conversation. Never send thinking, isolation, or subagent_type. When the session enables Agent Teams, passing name gives the teammate a stable address for the task board.',
    parameters: {
      description: {
        type: 'string',
        required: true,
        description: 'A short (3-5 word) description of the delegated task, for display.',
      },
      prompt: {
        type: 'string',
        required: true,
        description: 'The complete, self-contained task. The child does not see this conversation.',
      },
      role: {
        type: 'string',
        required: true,
        description: 'pstack role key. The nine mapped roles are feature, refactoring / bug-fix / perf-issue / hillclimb / judgment and prose / arena runners / arena cross-judge pool / swarm workers / interrogate reviewers. Any other name, such as how-explorer, inherits the parent route.',
      },
      name: {
        type: 'string',
        description: 'Optional name unique among the parent’s children, 1 to 32 lower-case letters, digits, or hyphens, starting with a letter and not lead.',
      },
      run_in_background: {
        type: 'boolean',
        description: 'Default true. Continuable children return a subagent id; one-shot background returns a job-like start without waiting.',
      },
      route_index: {
        type: 'number',
        description: 'Index into a mapped role’s routes. Omit to use its first route or inherit when unmapped. An explicit index requires an existing mapped seat.',
      },
      model: {
        type: 'string',
        description: 'Optional model to run this one child on, such as a weaker model for routine work or a stronger one for the hardest work. Must be a model pstack_catalog lists; omit to use the role line.',
      },
      provider: {
        type: 'string',
        description: 'Provider for the model override. Omit when exactly one listed provider serves that model.',
      },
      reasoning_effort: {
        type: 'string',
        description: 'Optional effort for this one child, one of the efforts the resolved model lists. Omit to use the role line or the model default.',
      },
    },
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error('pstack_spawn requires a calling agent')
      const subagents = host.subagents
      if (subagents === undefined) throw new Error('pstack_spawn requires ctx.subagents')
      const role = normalizeRole(String(args.role ?? ''))
      if (role.length === 0) throw new Error('pstack_spawn role is required')
      const overlay: Overlay = (await readOverlay(host.dshHome ?? resolveDshHome(host.env))).overlay

      const modelArg = stringArg(args.model)
      const providerArg = stringArg(args.provider)
      const effortArg = stringArg(args.reasoning_effort)
      if (providerArg !== undefined && modelArg === undefined) throw new Error('provider needs a model')
      if (args.route_index !== undefined && typeof args.route_index !== 'number') throw new Error('route_index must be a nonnegative integer')
      const catalog = modelArg !== undefined ? await buildCatalog(host, exec.signal) : undefined
      const model = modelArg !== undefined && catalog !== undefined ? resolveCallModel(catalog.routes, modelArg, providerArg) : undefined

      const resolved = resolveSpawn(overlay, {
        role,
        description: String(args.description ?? ''),
        prompt: String(args.prompt ?? ''),
        ...typeof args.name === 'string' ? { name: args.name } : {},
        runInBackground: args.run_in_background !== false,
        routeIndex: typeof args.route_index === 'number' ? args.route_index : undefined,
        ...model === undefined ? {} : { model },
        ...effortArg === undefined ? {} : { reasoningEffort: effortArg },
      })
      if (resolved.agentOptions === undefined && effortArg !== undefined) {
        throw new Error(`reasoning_effort "${effortArg}" needs a model, because role "${role}" has no mapped route`)
      }
      if (resolved.agentOptions !== undefined) {
        const routes = (catalog ?? await buildCatalog(host, exec.signal)).routes
        const live = routes.find(route => route.provider === resolved.agentOptions?.provider && route.model === resolved.agentOptions.model)
        if (live === undefined) throw new Error(`model "${resolved.agentOptions.provider}/${resolved.agentOptions.model}" is not listed by DSH. Run pstack_catalog.`)
        if (resolved.reasoningEffort !== undefined && !live.efforts.some(effort => effort.id === resolved.reasoningEffort)) {
          throw new Error(`model "${live.provider}/${live.model}" does not support effort "${resolved.reasoningEffort}". Listed efforts: ${live.efforts.map(effort => effort.id).join(', ') || '(none)'}.`)
        }
      }
      if (resolved.description.trim().length === 0) throw new Error('description is required')
      if (resolved.prompt.trim().length === 0) throw new Error('prompt is required')

      const persona = await loadPersona(resolved.role)
      const activation = await subagents.startActivation({
        provider: host.spawnProvider ?? SPAWN_PROVIDER,
        label: resolved.description,
        prompt: persona ? [...textPrompt(persona), ...textPrompt(resolved.prompt)] : textPrompt(resolved.prompt),
        parent,
        ...resolved.name === undefined ? {} : { name: resolved.name },
        signal: exec.signal ?? new AbortController().signal,
        delivery: resolved.runInBackground ? 'parent' : 'caller',
        ...resolved.agentOptions ? { agentOptions: { ...resolved.agentOptions,
          ...resolved.reasoningEffort ? { reasoningEffort: ReasoningEffortId(resolved.reasoningEffort) } : {},
        } } : {},
      })
      const receipt = {
        subagentId: activation.childId,
        name: activation.name,
        role: resolved.role,
        inherit: resolved.inherit,
        routeSource: resolved.routeSource,
      }
      if (resolved.runInBackground) return { kind: 'activation', ...receipt }
      try {
        const result = await activation.result
        return { kind: 'foreground', ...receipt, runId: activation.childId, output: result.output ?? null, stopReason: result.stopReason }
      } finally {
        await activation.dispose()
      }
    },
  }
}

export function interruptTool(host: ToolHost): ToolDefinition {
  return {
    name: TOOL_INTERRUPT,
    description: 'Stop one child’s current turn. Built-in presets disable the native interrupt_agent, so this is the interruption path.',
    parameters: {
      agent: { type: 'string', required: true, description: 'A non-empty child name from list_agents or its Session id.' },
    },
    async execute(args, exec) {
      if (typeof args.agent !== 'string' || args.agent.length === 0) throw new Error('agent is required')
      if (exec.agent === undefined) throw new Error('pstack_interrupt requires a calling agent')
      const subagents = host.subagents
      if (subagents === undefined) throw new Error('pstack_interrupt requires ctx.subagents')
      const targetId = await subagents.resolveName(exec.agent, args.agent, exec.signal ?? new AbortController().signal)
      await subagents.interrupt(targetId, { kind: 'ancestor', agent: exec.agent })
      return { interrupted: true, agent: targetId }
    },
  }
}

function stringArg(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function resolveCallModel(
  routes: readonly LiveRoute[],
  modelArg: string,
  providerArg: string | undefined,
): { provider: string; model: string } {
  const matches = routes.filter(route => route.model === modelArg || `${route.provider}/${route.model}` === modelArg)
  if (matches.length === 0) {
    throw new Error(`model "${modelArg}" is not listed by DSH. Run pstack_catalog and pick a listed model.`)
  }
  let chosen = matches[0]
  if (providerArg !== undefined) {
    const byProvider = matches.find(route => route.provider === providerArg)
    if (byProvider === undefined) {
      throw new Error(`model "${modelArg}" is not listed under provider "${providerArg}". Listed providers: ${matches.map(route => route.provider).join(', ')}.`)
    }
    chosen = byProvider
  } else if (matches.length > 1) {
    throw new Error(`model "${modelArg}" is listed by ${matches.map(route => route.provider).join(', ')}; send provider too.`)
  }
  return { provider: chosen.provider, model: chosen.model }
}
