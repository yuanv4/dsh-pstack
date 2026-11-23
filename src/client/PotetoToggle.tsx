/** Session header switch: poteto workflow on/off for the current session. */

import { useEffect, useState } from 'react'
import { POTETO_STATE_PATH } from '../ids.ts'

export interface PotetoToggleInjected {
  t: (key: 'switchOn' | 'switchOff' | 'switchTitleOn' | 'switchTitleOff' | 'switchBusy') => string
}

const CSS = `
.pstack-switch {
  flex:none; display:inline-flex; align-items:center; gap:4px; height:28px; padding:0 8px;
  border:1px solid var(--dsw-alias-border-l2); border-radius:var(--dsw-radius-sm, 6px);
  background:transparent; color:var(--dsw-alias-label-secondary); font:inherit; font-size:12px;
  line-height:18px; cursor:pointer; white-space:nowrap;
}
.pstack-switch:focus-visible { outline:var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset:2px; }
@media (hover:hover) { .pstack-switch:hover { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); } }
.pstack-switch[data-on="true"] { color:var(--dsw-alias-brand-primary); border-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); }
.pstack-switch[data-busy="true"] { opacity:.65; cursor:progress; }
.pstack-switch-dot { flex:none; width:6px; height:6px; border-radius:50%; background:currentColor; opacity:.6; }
.pstack-switch[data-on="true"] .pstack-switch-dot { opacity:1; }
`

interface Props {
  readonly sessionId: string | undefined
}

interface State {
  readonly enabled: boolean
  readonly denied: string[]
}

async function request(path: string, init?: RequestInit): Promise<State> {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...init })
  if (!response.ok) throw new Error(`switch request failed: ${response.status}`)
  return await response.json() as State
}

export function PotetoToggle({ sessionId, t }: Props & PotetoToggleInjected) {
  const [state, setState] = useState<State | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (sessionId === undefined) return
    let live = true
    setState(undefined)
    setFailed(false)
    request(`${POTETO_STATE_PATH}?session=${encodeURIComponent(sessionId)}`)
      .then(next => { if (live) setState(next) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [sessionId])

  if (sessionId === undefined || state === undefined) return null
  const toggle = async (): Promise<void> => {
    setBusy(true)
    setFailed(false)
    try {
      setState(await request(POTETO_STATE_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session: sessionId, enabled: !state.enabled }),
      }))
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  const label = state.enabled ? t('switchOn') : t('switchOff')
  return (
    <>
      <style>{CSS}</style>
      <button
        type="button"
        className="pstack-switch"
        data-on={state.enabled ? 'true' : 'false'}
        data-busy={busy ? 'true' : 'false'}
        disabled={busy}
        aria-pressed={state.enabled}
        title={state.enabled ? t('switchTitleOn') : t('switchTitleOff')}
        onClick={() => { void toggle() }}
      >
        <span className="pstack-switch-dot" aria-hidden="true" />
        {busy ? t('switchBusy') : label}
      </button>
    </>
  )
}
