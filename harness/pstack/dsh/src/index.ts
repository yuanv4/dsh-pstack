/**
 * pstack-dsh: DeepSeek Harness port of official pstack.
 * Function/namespace plugin: named apply, no default export.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-skill'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { snapshotJsonValue, type JsonValue } from '@deepseek-ai/dsh-util-values'
import { PLUGIN_ID, SPAWN_PROVIDER } from './ids.ts'
import { Config, type Config as PluginConfig } from './plugin-config.ts'
import { createSkillProvider } from './skills-provider.ts'
import {
  catalogTool,
  interruptTool,
  overlayReadTool,
  overlayWriteTool,
  spawnTool,
  type ToolHost,
} from './tools.ts'
import { registerPotetoMode, createPotetoSkillGate } from './poteto-mode.ts'
import { registerPstackPotetoRoutes } from './poteto-routes.ts'
import { registerPstackSettingsRoutes } from './settings-routes.ts'

export const name = PLUGIN_ID
export const inject = ['tools', 'skills', 'agents']
export { Config }
export type { PluginConfig as ConfigType }

const JSON_OUTPUT = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: JsonValue) => [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
}

function asHost(ctx: Context, config: PluginConfig | undefined): ToolHost {
  return {
    get llm() { return ctx.get('llm') as ToolHost['llm'] },
    get subagents() { return ctx.get('subagents') as ToolHost['subagents'] },
    spawnProvider: config?.spawnProvider ?? SPAWN_PROVIDER,
  }
}

function registerOne(ctx: Context, tool: ReturnType<typeof catalogTool>): void {
  ctx.tools.register(defineTool({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    output: JSON_OUTPUT,
    async execute(args: Record<string, unknown>, exec: { signal?: AbortSignal; agent?: Agent }): Promise<JsonValue> {
      const snapshot = snapshotJsonValue(await tool.execute(args, exec))
      if (snapshot === undefined) throw new TypeError(`pstack tool ${tool.name} returned a non-JSON value`)
      return snapshot as JsonValue
    },
  }))
}

export function apply(ctx: Context, config?: PluginConfig): void {
  console.log('[my-plugins/pstack-dsh] loaded')
  const host = asHost(ctx, config)
  registerOne(ctx, catalogTool(host))
  registerOne(ctx, overlayReadTool(host))
  registerOne(ctx, overlayWriteTool(host))
  registerOne(ctx, spawnTool(host))
  registerOne(ctx, interruptTool(host))
  // The provider must be able to drop the bundled skills from a model catalog
  // when the session switch changes, so the switch hands it an invalidation
  // callback. Registering the provider first would leave no callback to hand.
  let invalidateSkillCatalog = (): void => {}
  const poteto = registerPotetoMode(ctx, { onChanged: () => { invalidateSkillCatalog() } })
  ctx.skills.registerProvider(control => {
    invalidateSkillCatalog = control.invalidate
    return createSkillProvider(undefined, createPotetoSkillGate(poteto))
  })
  ctx.inject(['webServer', 'connection'], webCtx => {
    registerPstackSettingsRoutes(webCtx, host)
    registerPstackPotetoRoutes(webCtx, poteto)
  })
}
