/** Cordis plugin / Loader row id. */
export const PLUGIN_ID = 'pstack-dsh'

/** Bundled skill provider name on `ctx.skills`. */
export const SKILL_PROVIDER_NAME = 'pstack-dsh'

/** Overlay file under `$DSH_HOME`. */
export const OVERLAY_FILENAME = 'pstack-dsh.json'

/** Model-facing tool names this plugin registers. */
export const TOOL_CATALOG = 'pstack_catalog'
export const TOOL_SPAWN = 'pstack_spawn'
export const TOOL_INTERRUPT = 'pstack_interrupt'
export const TOOL_OVERLAY_READ = 'pstack_overlay_read'
export const TOOL_OVERLAY_WRITE = 'pstack_overlay_write'

/** Every tool above, in registration order. The session switch withholds them while it is off. */
export const PSTACK_TOOLS = [TOOL_CATALOG, TOOL_OVERLAY_READ, TOOL_OVERLAY_WRITE, TOOL_SPAWN, TOOL_INTERRUPT] as const

/** Default in-process spawn provider. `packages/bundle/base/cordis.patch.yml` `providerName: spawn`. */
export const SPAWN_PROVIDER = 'spawn'

/** Role editor entry id. Official slot `plugins.detail.actions` (`packages/client/ui-plugin-manager/src/client/slot-contract.ts`). */
export const ROLE_EDITOR_ENTRY_ID = 'pstack-role-settings'

/** Same-origin Web routes. Pattern: dsh-oauth-login `src/auth-routes.ts`. */
export const SETTINGS_SNAPSHOT_PATH = '/plugins/pstack-dsh/settings'
export const SETTINGS_SAVE_PATH = '/plugins/pstack-dsh/settings'

/** Session switch state and toggle. */
export const POTETO_STATE_PATH = '/plugins/pstack-dsh/poteto'
