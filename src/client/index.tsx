/** Browser half: the pstack role editor opens from the plugin detail page. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-connection/client'
import type { PluginDetailProps } from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import { useId, useRef, useState } from 'react'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { PotetoToggle } from './PotetoToggle.tsx'
import { PstackSettings } from './PstackSettings.tsx'
import type { PstackSettingsInjected } from './PstackSettings.tsx'
import { en, zh } from './locales.ts'
import type { PstackSettingsKey } from './locales.ts'
import { PLUGIN_ID, ROLE_EDITOR_ENTRY_ID } from '../ids.ts'
import { listenForCatalogChanges } from './api.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.pstack': PstackSettingsKey
  }
}

export const name = 'pstack-dsh-client'
export const inject = ['slots', 'locale', 'remote']

const CHROME_CSS = `
.pstack-trigger {
  flex:none; height:28px; padding:0 10px; border:1px solid var(--dsw-alias-border-l2);
  border-radius:var(--dsw-radius-sm, 6px); background:transparent; color:var(--dsw-alias-label-primary);
  font:inherit; font-size:12px; line-height:18px; cursor:pointer;
}
.pstack-trigger:focus-visible { outline:var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset:2px; }
@media (hover:hover) { .pstack-trigger:hover { background:var(--dsw-alias-interactive-bg-hover); } }
.pstack-trigger:active { background:var(--dsw-alias-interactive-bg-active); }

.pstack-dialog {
  box-sizing:border-box; padding:0; overflow:hidden;
  width:min(860px, calc(100vw - 32px)); max-height:calc(100dvh - 48px);
  border:0; border-radius:var(--dsw-radius-panel, 16px);
  box-shadow:var(--dsw-elevation-prominent, 0 12px 32px rgb(0 0 0 / 24%));
  background:var(--dsw-alias-bg-layer-2); color:var(--dsw-alias-label-primary);
}
/* Author display beats the UA rule for closed dialogs, so scope flex to the open state. */
.pstack-dialog[open] { display:flex; flex-direction:column; gap:0; }
.pstack-dialog:not([open]) { display:none; }
.pstack-dialog::backdrop { background:var(--dsw-alias-bg-mask-1, rgb(0 0 0 / 40%)); backdrop-filter:var(--dsw-mask-blur, blur(2px)); }
.pstack-dialog-head {
  flex:none; display:flex; align-items:flex-start; gap:12px;
  padding:16px 16px 12px; border-bottom:0.5px solid var(--dsw-alias-border-l2);
}
.pstack-dialog-titles { display:flex; flex-direction:column; gap:2px; min-width:0; }
.pstack-dialog-title { margin:0; font-size:16px; line-height:24px; font-weight:500; color:var(--dsw-alias-label-primary); }
.pstack-dialog-sub { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }
.pstack-dialog-close {
  flex:none; margin-left:auto; display:grid; place-items:center; width:28px; height:28px; padding:0;
  border:1px solid transparent; border-radius:var(--dsw-radius-sm, 6px); background:transparent;
  color:var(--dsw-alias-label-secondary); cursor:pointer;
}
.pstack-dialog-close:focus-visible { outline:var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset:2px; }
@media (hover:hover) { .pstack-dialog-close:hover { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); } }
.pstack-dialog-body { display:flex; flex-direction:column; flex:1 1 auto; min-height:0; overflow:auto; overscroll-behavior:contain; }
`

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function PstackDetailAction({ subject, t, subscribeCatalogChanges }: PluginDetailProps & PstackSettingsInjected) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  if (subject.kind !== 'bundle' || subject.pkg.name !== PLUGIN_ID) return null
  return (
    <>
      <style>{CHROME_CSS}</style>
      <button
        type="button"
        className="pstack-trigger"
        title={t('rolesAndModels')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          dialog.current?.showModal()
          setMounted(true)
          setOpen(true)
        }}
      >
        {t('nav')}
      </button>
      <dialog
        ref={dialog}
        className="pstack-dialog"
        aria-labelledby={titleId}
        data-window-drag-exclude=""
        onClose={() => setOpen(false)}
        onClick={event => { if (event.target === dialog.current) dialog.current.close() }}
      >
        <header className="pstack-dialog-head">
          <div className="pstack-dialog-titles">
            <h2 id={titleId} className="pstack-dialog-title">{t('title')}</h2>
            <p className="pstack-dialog-sub">{t('intro')}</p>
          </div>
          <button type="button" className="pstack-dialog-close" aria-label={t('close')} title={t('close')} onClick={() => dialog.current?.close()}>
            <CloseIcon />
          </button>
        </header>
        <div className="pstack-dialog-body">
          {mounted && <PstackSettings t={t} subscribeCatalogChanges={subscribeCatalogChanges} active={open} />}
        </div>
      </dialog>
    </>
  )
}

export function apply(ctx: Context): void {
  const namespace = 'settings.pstack'
  ctx.effect(() => ctx.locale.register(namespace, { zh, en }), 'pstack-dsh: editor copy')
  const t: PstackSettingsInjected['t'] = ctx.locale.bind(namespace)
  const subscribeCatalogChanges: PstackSettingsInjected['subscribeCatalogChanges'] = listener =>
    listenForCatalogChanges(ctx, listener)
  ctx.slots.inject('plugins.detail.actions', () => ctx.slots.register({
    name: 'plugins.detail.actions',
    id: ROLE_EDITOR_ENTRY_ID,
    inject: (): PstackSettingsInjected => ({ t, subscribeCatalogChanges }),
  }, PstackDetailAction))
  // Session header switch: poteto workflow on/off for the open session. The slot
  // engine passes the session id to `inject`, so the toggle never guesses it.
  const switchSlot = 'conversation.session.header.actions'
  ctx.slots.inject(switchSlot as never, () => ctx.slots.register({
    name: switchSlot,
    id: 'pstack-poteto-switch',
    order: 40,
    locale: namespace,
    inject: (sessionId: string) => ({ sessionId, t }),
  } as never, PotetoToggle as never))
}
