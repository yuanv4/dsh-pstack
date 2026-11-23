import { resolveDshHome } from './home.ts'
import { readOverlay, routeKey } from './overlay.ts'
import type { CatalogResult, LiveEffort, LiveRoute } from './catalog-types.ts'

export type { CatalogResult, LiveEffort, LiveRoute } from './catalog-types.ts'

interface ModelInfo {
  id: string
  name: string
  reasoning?: { efforts: readonly LiveEffort[]; defaultEffort?: string }
}

interface LlmLike {
  listProviders(): readonly { id: string; name: string }[]
  listModels(provider: string): Promise<readonly { id: string; name: string }[]>
  resolveModelInfo(provider: string, model: string, signal?: AbortSignal): Promise<ModelInfo>
}

export interface CatalogHost {
  llm?: LlmLike
  dshHome?: string
  env?: NodeJS.ProcessEnv
}

/** DSH owns model availability; resolution adds optional effort metadata. */
export async function buildCatalog(host: CatalogHost, signal?: AbortSignal): Promise<CatalogResult> {
  const overlay = await readOverlay(host.dshHome ?? resolveDshHome(host.env))
  const routes: LiveRoute[] = []
  const seen = new Set<string>()
  const { llm } = host

  if (llm !== undefined) {
    for (const provider of llm.listProviders()) {
      const models = await llm.listModels(provider.id).catch(() => [])
      for (const model of models) {
        const key = routeKey(provider.id, model.id)
        if (seen.has(key)) continue
        seen.add(key)

        const resolved = await llm.resolveModelInfo(provider.id, model.id, signal).catch(() => undefined)
        const reasoning = resolved?.reasoning
        const efforts = reasoning?.efforts.map(({ id, name, description }) => ({
          id,
          name,
          ...description === undefined ? {} : { description },
        })) ?? []
        const defaultEffort = reasoning?.defaultEffort
        routes.push({
          provider: provider.id,
          providerName: provider.name,
          model: model.id,
          modelName: resolved?.name || model.name,
          efforts,
          ...defaultEffort === undefined ? {} : { defaultEffort },
        })
      }
    }
  }

  return {
    routes,
    overlayPath: overlay.path,
    overlayMissing: overlay.missing,
    inheritParent: true,
    ...routes.length === 0 ? { emptyReason: 'DSH lists no available models. Children inherit this conversation.' } : {},
  }
}
