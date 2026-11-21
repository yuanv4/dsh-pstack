/**
 * The nine pstack roles, matching `cursor/plugins/pstack`
 * `skills/setup-pstack` step 5 line for line.
 *
 * Role keys are matched exactly after whitespace and comma normalization.
 * Commas belong to one key (`feature, refactoring`), so a key is never split on
 * a comma. Skill text may still name a delegate role that has no line here, such
 * as `how-explorer`; such a role simply inherits the parent conversation.
 */

/** Roles that hold one route each. */
export const SCALAR_ROLES = [
  'feature, refactoring',
  'bug-fix',
  'perf-issue',
  'hillclimb',
  'judgment and prose',
] as const

/** Roles that hold a list of routes, one child per entry. */
export const PANEL_ROLES = [
  'arena runners',
  'arena cross-judge pool',
  'swarm workers',
  'interrogate reviewers',
] as const

export const ALL_ROLES = [...SCALAR_ROLES, ...PANEL_ROLES] as const

export type ScalarRole = (typeof SCALAR_ROLES)[number]
export type PanelRole = (typeof PANEL_ROLES)[number]
/** A role that can hold a model mapping. */
export type PstackRole = (typeof ALL_ROLES)[number]

/** Names the earlier port taxonomy used, mapped onto the upstream lines. */
const LEGACY_ALIASES: Readonly<Record<string, PstackRole>> = {
  feature: 'feature, refactoring',
  refactoring: 'feature, refactoring',
  'judgment-and-prose': 'judgment and prose',
  'arena-runners': 'arena runners',
  'arena-cross-judge-pool': 'arena cross-judge pool',
  'swarm-workers': 'swarm workers',
  'interrogate-reviewers': 'interrogate reviewers',
}

/** Roles upstream retired. A mapping that names one is dropped, not an error. */
export const RETIRED_ROLES = [
  'how-critics',
  'how-explorer',
  'how-explainer',
  'why-investigators',
  'why-synthesizer',
  'reflect-tooling',
  'reflect-judgment',
  'reflect-fixers',
  'architect-runners',
  'hardest-tasks',
  'poteto-agent',
  'comment-sicko',
  'independent-verifier',
] as const

const RETIRED_SET = new Set<string>(RETIRED_ROLES)

/** Normalize spacing and comma formatting without splitting a key. */
export function normalizeRoleName(raw: string): string {
  return raw
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim()
}

/**
 * Resolve a caller-supplied role to its canonical spelling.
 *
 * A name outside the nine lines is kept as written so that skill roles without a
 * mapping, such as `how-explorer`, still spawn on the parent route.
 */
export function normalizeRole(raw: string): string {
  const key = normalizeRoleName(raw)
  if (key === 'poteto agent') return 'poteto-agent'
  if (key === 'comment sicko') return 'comment-sicko'
  if (key === 'generalpurpose' || key === 'general purpose' || key === 'general-purpose') return 'poteto-agent'
  return LEGACY_ALIASES[key] ?? key
}

/** Whether a name is one of the nine configurable roles. */
export function isPstackRole(value: string): value is PstackRole {
  return (ALL_ROLES as readonly string[]).includes(value)
}

/** Whether a normalized name is a retired upstream role. */
export function isRetiredRole(value: string): boolean {
  const key = normalizeRoleName(value)
  return RETIRED_SET.has(key) || RETIRED_SET.has(LEGACY_ALIASES[key] ?? '')
}

export function isPanelRole(value: string): value is PanelRole {
  return (PANEL_ROLES as readonly string[]).includes(value)
}
