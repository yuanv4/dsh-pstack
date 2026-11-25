/** Browser half: the pstack role editor lives in the bundle's configuration page. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { PotetoToggle } from './PotetoToggle.tsx'
import { PstackSettings } from './PstackSettings.tsx'
import type { PstackSettingsInjected } from './PstackSettings.tsx'
import { en, zh } from './locales.ts'
import type { PstackSettingsKey } from './locales.ts'
import { PLUGIN_ID } from '../ids.ts'
import { listenForCatalogChanges, readPotetoState, setPotetoState } from './api.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.pstack': PstackSettingsKey
  }
}

export const name = 'pstack-dsh-client'
export const inject = ['slots', 'locale', 'remote']

export function apply(ctx: Context): void {
  const namespace = 'settings.pstack'
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'pstack-dsh: editor copy')
  const t: PstackSettingsInjected['t'] = ctx.locale.bind(namespace)
  const subscribeCatalogChanges: PstackSettingsInjected['subscribeCatalogChanges'] = listener =>
    listenForCatalogChanges(ctx, listener)
  // A bundle's own configuration belongs in this slot, keyed by its package
  // name: the Plugins page draws the title, icon, and crumb itself and renders
  // the form between the bundle's description and its component rows.
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: PLUGIN_ID,
    locale: namespace,
    inject: (): PstackSettingsInjected => ({ t, subscribeCatalogChanges }),
  }, PstackSettings))
  // Model-menu switch: sits beside the Agent Teams row. The slot engine passes
  // the session id to `inject`, so the toggle never guesses it.
  const switchSlot = 'conversation.input.model.options'
  ctx.slots.inject(switchSlot as never, () => ctx.slots.register({
    name: switchSlot,
    id: 'pstack-poteto-switch',
    locale: namespace,
    inject: (sessionId: string) => ({
      sessionId,
      t,
      readMode: async () => (await readPotetoState(sessionId)).enabled,
      selectMode: async (enabled: boolean) => {
        try {
          await setPotetoState(sessionId, enabled)
          return null
        } catch (error: unknown) {
          return error instanceof Error ? error.message : 'switch failed'
        }
      },
    }),
  } as never, PotetoToggle as never))
}
