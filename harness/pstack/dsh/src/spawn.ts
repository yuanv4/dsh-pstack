import type { Overlay, OverlayRoute } from './overlay.ts'
import { resolveRole } from './overlay.ts'
import { normalizeRole } from './roles.ts'

export interface SpawnRequest {
  readonly role: string
  readonly description: string
  readonly prompt: string
  readonly runInBackground: boolean
  readonly routeIndex?: number
  /** Per-call model route, used to adjust one job away from the role line. */
  readonly model?: { readonly provider: string; readonly model: string }
  /** Per-call effort; mapped effort defaults only when the model route is unchanged. */
  readonly reasoningEffort?: string
}

export interface AgentOptions {
  provider?: string
  model?: string
}

export interface ResolvedSpawn {
  readonly role: string
  readonly description: string
  readonly prompt: string
  readonly runInBackground: boolean
  readonly inherit: boolean
  readonly agentOptions?: AgentOptions
  readonly reasoningEffort?: string
  readonly route?: OverlayRoute
  /** Where the route came from: an explicit call route, the role line, or the parent conversation. */
  readonly routeSource: 'call' | 'role' | 'inherit'
}

/**
 * Resolve one spawn. Precedence follows upstream: an explicit per-call model
 * wins, then the role's line, then the parent conversation. An explicit effort
 * adjusts whichever model won.
 */
export function resolveSpawn(overlay: Overlay, request: SpawnRequest): ResolvedSpawn {
  const role = normalizeRole(request.role)
  const assignment = resolveRole(overlay, role)
  const index = request.routeIndex ?? 0
  if (!Number.isInteger(index) || index < 0 || (request.routeIndex !== undefined && index >= assignment.routes.length)) {
    throw new Error(`route_index ${index} is invalid for role "${role}" with ${assignment.routes.length} routes`)
  }
  const route = assignment.inherit ? undefined : assignment.routes[index]
  const agentOptions = request.model ?? (route === undefined ? undefined : { provider: route.provider, model: route.model })
  const sameRoute = request.model === undefined || (request.model.provider === route?.provider && request.model.model === route.model)
  const reasoningEffort = request.reasoningEffort ?? (sameRoute ? route?.reasoningEffort : undefined)
  return {
    role,
    description: request.description,
    prompt: request.prompt,
    runInBackground: request.runInBackground,
    inherit: agentOptions === undefined,
    ...agentOptions === undefined ? {} : { agentOptions },
    ...reasoningEffort === undefined ? {} : { reasoningEffort },
    ...route === undefined ? {} : { route },
    routeSource: request.model !== undefined ? 'call' : agentOptions !== undefined ? 'role' : 'inherit',
  }
}
