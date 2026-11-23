/**
 * Model-options row: poteto workflow on/off for the current session.
 *
 * Copied from the Agent Teams row (`dsh-client-ui-agent-team` TeamModeToggle) so
 * the two switches read the same in the model menu.
 */

import { useEffect, useState } from 'react'
import { Button, IconInfoOutlineRegular, Switch, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'

export interface PotetoToggleInjected {
  readonly sessionId: string
  readonly readMode: () => Promise<boolean>
  readonly selectMode: (enabled: boolean) => Promise<string | null>
  readonly t: (key: 'switchLabel' | 'switchDescription' | 'switchInfoLabel') => string
}

const STYLE_ID = 'pstack-poteto-row-style'
const ROW_CSS = `
.pstack-poteto-row {
  border-radius: var(--dsw-radius-md);
  min-height: 34px;
  color: var(--dsw-alias-label-primary);
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 0 8px;
  font-size: 13px;
  line-height: 20px;
  display: flex;
  position: relative;
}
.pstack-poteto-label { align-items: center; gap: 4px; min-width: 0; display: inline-flex; }
.pstack-poteto-info { z-index: 1; width: 20px; height: 20px; color: var(--dsw-alias-label-caption); flex: none; padding: 0; position: relative; }
.pstack-poteto-row .pstack-poteto-switch { position: static; }
.pstack-poteto-row .pstack-poteto-switch:after { content: ""; border-radius: var(--dsw-radius-md); position: absolute; inset: 0; }
.pstack-poteto-row:has(.pstack-poteto-switch:focus-visible) { background: var(--dsw-alias-interactive-bg-hover); }
@media (hover: hover) {
  .pstack-poteto-row:has(.pstack-poteto-switch:not(:disabled)):hover { background: var(--dsw-alias-interactive-bg-hover); }
}
`

function ensureStyle(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = ROW_CSS
  document.head.append(style)
}

export function PotetoToggle({ sessionId, readMode, selectMode, t }: PotetoToggleInjected) {
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    ensureStyle()
    setEnabled(undefined)
    setFailure(null)
    readMode().then(value => { if (live) setEnabled(value) }, () => { if (live) setFailure(null) })
    return () => { live = false }
  }, [sessionId, readMode])

  if (enabled === undefined) return null

  const select = (next: boolean): void => {
    setPending(true)
    setFailure(null)
    selectMode(next).then(
      error => {
        if (error === null) setEnabled(next)
        else setFailure(error)
      },
      error => { setFailure(error instanceof Error ? error.message : String(error)) },
    ).finally(() => { setPending(false) })
  }

  return (
    <div className="pstack-poteto-row" title={failure ?? undefined}>
      <span className="pstack-poteto-label">
        <span>{t('switchLabel')}</span>
        <Tooltip label={t('switchDescription')} side="top" delayMs={300} maxWidth={300} portal openOnClick>
          <Button variant="ghost" size="sm" className="pstack-poteto-info" aria-label={t('switchInfoLabel')}>
            <IconInfoOutlineRegular size={11} aria-hidden="true" />
          </Button>
        </Tooltip>
      </span>
      <Switch
        className="pstack-poteto-switch"
        checked={enabled}
        disabled={pending}
        label={t('switchLabel')}
        onChange={select}
      />
    </div>
  )
}
