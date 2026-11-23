import type { Agent } from '@deepseek-ai/dsh-agent'
import { ReasoningEffortId, type ContentBlock } from '@deepseek-ai/dsh-llm'
import type { SubagentRuntime } from '@deepseek-ai/dsh-subagent'
import type { ParameterSchemaSpec } from '@deepseek-ai/dsh-tools'
import type { CatalogHost } from './catalog.ts'
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
import { resolveRole } from './overlay.ts'
import { resolveSpawn } from './spawn.ts'
import { normalizeRole } from './roles.ts'
import {
  SPAWN_PROVIDER,
  TOOL_CATALOG,
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
  subagents?: Pick<SubagentRuntime, 'startActivation'>
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
      'Delegate a pstack role to a DSH subagent via ctx.subagents (spawn provider). Send description, prompt, role, and optional run_in_background. The role line in $DSH_HOME/pstack-dsh.json supplies the default route; send model or reasoning_effort only to adjust one job away from it. A role with no line inherits this conversation. Never send thinking, isolation, or subagent_type.',
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
      run_in_background: {
        type: 'boolean',
        description: 'Default true. Continuable children return a subagent id; one-shot background returns a job-like start without waiting.',
      },
      route_index: {
        type: 'number',
        description: 'Which overlay route to use for a panel role. Default 0.',
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
      const call = await resolveCallRoute(host, overlay, role, modelArg, providerArg, effortArg, exec.signal)

      const resolved = resolveSpawn(overlay, {
        role,
        description: String(args.description ?? ''),
        prompt: String(args.prompt ?? ''),
        runInBackground: args.run_in_background !== false,
        routeIndex: typeof args.route_index === 'number' ? args.route_index : undefined,
        ...call.model === undefined ? {} : { model: call.model },
        ...call.reasoningEffort === undefined ? {} : { reasoningEffort: call.reasoningEffort },
      })
      if (resolved.description.trim().length === 0) throw new Error('description is required')
      if (resolved.prompt.trim().length === 0) throw new Error('prompt is required')

      const persona = await loadPersona(resolved.role)
      const activation = await subagents.startActivation({
        provider: host.spawnProvider ?? SPAWN_PROVIDER,
        label: resolved.description,
        prompt: persona ? [...textPrompt(persona), ...textPrompt(resolved.prompt)] : textPrompt(resolved.prompt),
        parent,
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

function stringArg(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

/**
 * Validate a per-call route against the live catalog.
 *
 * Model names are how upstream skills talk about routes, and DSH additionally
 * needs a provider, so the provider is resolved from the catalog unless the call
 * names one. An explicit effort must be one the resolved model lists.
 */
async function resolveCallRoute(
  host: ToolHost,
  overlay: Overlay,
  role: string,
  modelArg: string | undefined,
  providerArg: string | undefined,
  effortArg: string | undefined,
  signal: AbortSignal | undefined,
): Promise<{ model?: { provider: string; model: string }; reasoningEffort?: string }> {
  if (modelArg === undefined) {
    if (providerArg !== undefined) throw new Error('provider needs a model')
    if (effortArg === undefined) return {}
    const assignment = resolveRole(overlay, role)
    const mapped = !assignment.inherit && assignment.routes.length > 0
    if (!mapped) throw new Error(`reasoning_effort "${effortArg}" needs a model, because role "${role}" has no mapped route`)
    return { reasoningEffort: effortArg }
  }

  const catalog = await buildCatalog(host, signal)
  const matches = catalog.routes.filter(route => route.model === modelArg || `${route.provider}/${route.model}` === modelArg)
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
  if (effortArg !== undefined && chosen.efforts.length > 0 && !chosen.efforts.some(effort => effort.id === effortArg)) {
    throw new Error(`model "${modelArg}" does not support effort "${effortArg}". Listed efforts: ${chosen.efforts.map(effort => effort.id).join(', ')}.`)
  }
  return {
    model: { provider: chosen.provider, model: chosen.model },
    ...effortArg === undefined ? {} : { reasoningEffort: effortArg },
  }
}

export const ALL_TOOLS = [catalogTool, overlayReadTool, overlayWriteTool, spawnTool] as const
