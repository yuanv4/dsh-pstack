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
import { resolveSpawn } from './spawn.ts'
import { isPstackRole, normalizeRole } from './roles.ts'
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
      'Delegate a pstack role to a DSH subagent via ctx.subagents (spawn provider). Send description, prompt, role, and optional run_in_background. Do not send model, provider, reasoning_effort, thinking, isolation, or subagent_type. Route and effort come from $DSH_HOME/pstack-dsh.json when that role is mapped to a route listed by DSH; otherwise the child inherits this conversation.',
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
        description: 'pstack role key (feature, how-explainer, poteto-agent, comment-sicko, …).',
      },
      run_in_background: {
        type: 'boolean',
        description: 'Default true. Continuable children return a subagent id; one-shot background returns a job-like start without waiting.',
      },
      route_index: {
        type: 'number',
        description: 'Which overlay route to use for a panel role. Default 0.',
      },
    },
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error('pstack_spawn requires a calling agent')
      const subagents = host.subagents
      if (subagents === undefined) throw new Error('pstack_spawn requires ctx.subagents')
      const role = normalizeRole(String(args.role ?? ''))
      if (role === 'how-critics') {
        return { kind: 'disabled', role, reason: 'how-critics was retired in pstack 0.15; no agent was started.' }
      }
      if (!isPstackRole(role) && role.length === 0) throw new Error('pstack_spawn role is required')
      const overlay: Overlay = (await readOverlay(host.dshHome ?? resolveDshHome(host.env))).overlay
      const resolved = resolveSpawn(overlay, {
        role,
        description: String(args.description ?? ''),
        prompt: String(args.prompt ?? ''),
        runInBackground: args.run_in_background !== false,
        routeIndex: typeof args.route_index === 'number' ? args.route_index : undefined,
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
      const receipt = { subagentId: activation.childId, name: activation.name, role: resolved.role, inherit: resolved.inherit }
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

export const ALL_TOOLS = [catalogTool, overlayReadTool, overlayWriteTool, spawnTool] as const
