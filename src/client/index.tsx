/** Browser half: pstack roles on the plugin detail page. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type { PluginDetailProps } from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { useRef, useState } from 'react'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { PstackSettings } from './PstackSettings.tsx'
import type { PstackSettingsInjected } from './PstackSettings.tsx'
import { en, zh } from './locales.ts'
import type { PstackSettingsKey } from './locales.ts'
import { PLUGIN_ID } from '../ids.ts'
import { listenForCatalogChanges } from './api.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.pstack': PstackSettingsKey
  }
}

export const name = 'pstack-dsh-client'
export const inject = ['slots', 'locale', 'remote']

function PstackDetailAction({ subject, t, subscribeCatalogChanges }: PluginDetailProps & PstackSettingsInjected) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [opened, setOpened] = useState(false)
  if (subject.kind !== 'bundle' || subject.pkg.name !== PLUGIN_ID) return null
  return <>
    <style>{`
      .pstack-detail-dialog { width:min(760px, calc(100vw - 32px)); max-height:calc(100dvh - 32px); box-sizing:border-box; padding:20px; border:1px solid var(--dsw-alias-border-l2); border-radius:12px; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); }
      .pstack-detail-dialog::backdrop { background:rgb(0 0 0 / 45%); }
      .pstack-detail-action { min-height:32px; padding:0 12px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px; background:var(--dsw-alias-bg-module-platform); color:var(--dsw-alias-label-primary); font:inherit; cursor:pointer; }
      .pstack-detail-action:focus-visible { outline:2px solid var(--dsw-alias-brand-primary); }
      .pstack-detail-close { display:flex; justify-content:flex-end; margin-bottom:8px; }
    `}</style>
    <button type="button" className="pstack-detail-action" onClick={() => { dialog.current?.showModal(); setOpened(true) }}>{t('nav')}</button>
    <dialog ref={dialog} className="pstack-detail-dialog" aria-label={t('title')}>
      <form method="dialog" className="pstack-detail-close">
        <button className="pstack-detail-action" aria-label={t('close')}>×</button>
      </form>
      {opened && <PstackSettings t={t} subscribeCatalogChanges={subscribeCatalogChanges} />}
    </dialog>
  </>
}

export function apply(ctx: Context): void {
  const namespace = 'settings.pstack'
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'pstack-dsh: settings copy')
  const t: PstackSettingsInjected['t'] = ctx.locale.bind(namespace)
  const subscribeCatalogChanges: PstackSettingsInjected['subscribeCatalogChanges'] = listener =>
    listenForCatalogChanges(ctx, listener)
  ctx.slots.inject('plugins.detail.actions', () => ctx.slots.register({
    name: 'plugins.detail.actions',
    id: 'pstack-role-settings',
    inject: (): PstackSettingsInjected => ({ t, subscribeCatalogChanges }),
  }, PstackDetailAction))
}
