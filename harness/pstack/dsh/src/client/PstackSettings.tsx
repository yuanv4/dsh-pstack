/**
 * pstack role editor. DSH renders a bundle's configuration in the
 * `plugins.bundle.config` slot of its Plugins page, between the bundle's
 * description and its component rows, with `view: 'page'` and its own save.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button, IconPlusOutlineRegular, IconTrashOutlineRegular, StateDot, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PluginConfigViewProps } from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type { LiveRoute } from '../catalog-types.ts'
import type { Overlay, OverlayRoute } from '../overlay-model.ts'
import { routeKey } from '../overlay-model.ts'
import {
  applyInheritAll,
  applyRouteToAll,
  draftToOverlay,
  liveFor,
  overlayToDraft,
  parseRouteSelectValue,
  routeSelectValue,
  stripIllegalEffort,
  type RoleDraft,
} from '../settings-draft.ts'
import { PANEL_ROLES, type PstackRole } from '../roles.ts'
import { loadSettingsSnapshot, saveSettingsDefault, saveSettingsOverlay } from './api.ts'
import type { PstackSettingsKey } from './locales.ts'

export interface PstackSettingsInjected {
  t: (key: PstackSettingsKey, params?: Record<string, unknown>) => string
  subscribeCatalogChanges: (listener: () => void) => () => void
}

/** Owner props of the bundle's configuration page; it only asks for `page`. */
export type PstackSettingsProps = PluginConfigViewProps & PstackSettingsInjected

type GroupKey = 'groupDelegates' | 'groupJudgment' | 'groupPanels'

const GROUPS: { id: GroupKey; roles: readonly PstackRole[] }[] = [
  { id: 'groupDelegates', roles: ['feature, refactoring', 'bug-fix', 'perf-issue', 'hillclimb'] },
  { id: 'groupJudgment', roles: ['judgment and prose'] },
  { id: 'groupPanels', roles: [...PANEL_ROLES] },
]

const VISIBLE_ROLES = GROUPS.flatMap(group => group.roles)

const DESCRIPTION_KEY = {
  'feature, refactoring': 'descFeatureRefactoring',
  'bug-fix': 'descBugFix',
  'perf-issue': 'descPerfIssue',
  hillclimb: 'descHillclimb',
  'judgment and prose': 'descJudgment',
  'arena runners': 'descArenaRunners',
  'arena cross-judge pool': 'descArenaJudge',
  'swarm workers': 'descSwarmWorkers',
  'interrogate reviewers': 'descInterrogateReviewers',
} as const satisfies Record<PstackRole, PstackSettingsKey>

/**
 * Form metrics follow the Host's own settings surfaces: the plugin page's
 * 14/20 section heading with its 12/18 count, `.input` (32px, hairline `l4`,
 * 12px radius) for every field, `Tag` for counts, `StateDot` for save state, the
 * model editor's filled `bg-module-platform` surface for a nested multi-route
 * editor, and a footer row that ends the form in place of a pinned bar.
 */
const SETTINGS_CSS = `
.pstack-page { display:flex; flex-direction:column; gap:16px; width:100%; max-width:760px; color:var(--dsw-alias-label-primary); }

.pstack-head { display:flex; flex-direction:column; gap:4px; }
.pstack-section-head { display:flex; align-items:baseline; gap:10px; }
.pstack-section-title { margin:0; font-size:14px; line-height:20px; font-weight:500; color:var(--dsw-alias-label-primary); }
.pstack-section-count { font-size:12px; line-height:18px; color:var(--dsw-alias-label-secondary); font-variant-numeric:tabular-nums; }
.pstack-intro { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }

.pstack-tools { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
.pstack-search { position:relative; display:flex; flex:1 1 180px; align-items:center; min-width:120px; color:var(--dsw-alias-label-tertiary); }
.pstack-search > svg { position:absolute; left:10px; pointer-events:none; }
.pstack-search input {
  box-sizing:border-box; width:100%; height:32px; padding:0 10px 0 32px;
  border:0.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary);
  font:inherit; font-size:13px; line-height:22px;
}
.pstack-search input::placeholder { color:var(--dsw-alias-label-dimmed); }
.pstack-search input:focus { outline:none; border-color:var(--dsw-alias-state-business-primary); }

.pstack-select {
  box-sizing:border-box; width:100%; height:32px; min-width:0; padding:0 8px;
  border:0.5px solid var(--dsw-alias-border-l4); border-radius:var(--dsw-radius-md);
  background:var(--dsw-alias-bg-layer-1); color:var(--dsw-alias-label-primary);
  font:inherit; font-size:13px; line-height:22px;
}
.pstack-select:focus { outline:none; border-color:var(--dsw-alias-state-business-primary); }
.pstack-select:disabled { opacity:.6; cursor:default; }
.pstack-select--auto { flex:0 1 200px; width:auto; max-width:200px; }

.pstack-defaults { display:flex; flex-direction:column; gap:8px; }
.pstack-default-row { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px 16px; }
.pstack-default-text { display:flex; flex:1 1 220px; flex-direction:column; gap:2px; min-width:0; }
.pstack-default-label { font-size:13px; line-height:18px; font-weight:500; color:var(--dsw-alias-label-primary); }
.pstack-default-desc { font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }

.pstack-group { display:flex; flex-direction:column; gap:8px; }
.pstack-group-head { display:flex; align-items:baseline; gap:8px; }
.pstack-group-title { margin:0; font-size:14px; line-height:20px; font-weight:500; color:var(--dsw-alias-label-primary); }
.pstack-group-count { font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); font-variant-numeric:tabular-nums; }
.pstack-hint { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }

.pstack-card {
  border:0.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-xl);
  background:var(--dsw-alias-settings-card-fill); overflow:hidden;
}
.pstack-card > * + * { border-top:0.5px solid var(--dsw-alias-border-l2); }

.pstack-row {
  display:grid; grid-template-columns:minmax(0,1fr) minmax(180px,290px) minmax(96px,104px);
  gap:10px; align-items:center; padding:8px 14px;
}
.pstack-id { display:flex; flex-direction:column; gap:1px; min-width:0; }
.pstack-id-line { display:flex; align-items:baseline; gap:8px; min-width:0; }
.pstack-role {
  min-width:0; font-family:var(--ds-font-family-code); font-size:13px; line-height:18px; font-weight:500;
  color:var(--dsw-alias-label-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.pstack-desc { font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pstack-spacer { min-height:1px; }
.pstack-inline { display:flex; align-items:center; gap:8px; min-width:0; }

.pstack-panel-head { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; align-items:center; padding:8px 14px; }
.pstack-panel-body { display:flex; flex-direction:column; gap:8px; margin:0 14px 12px; padding:12px; border-radius:var(--dsw-radius-lg); background:var(--dsw-alias-bg-module-platform); }
.pstack-panel-body > .pstack-add { align-self:flex-start; }
.pstack-route-row { display:grid; grid-template-columns:16px minmax(0,1fr) minmax(96px,104px) auto; gap:8px; align-items:center; }
.pstack-index { font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); text-align:right; font-variant-numeric:tabular-nums; }
/* Later than the shared Button rules and more specific, so the icon-only row action keeps its 28px box. */
.pstack-remove.pstack-remove { width:28px; min-width:28px; padding:0; color:var(--dsw-alias-label-tertiary); }
@media (hover:hover) {
  .pstack-remove.pstack-remove:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover-danger); color:var(--dsw-alias-state-error-primary); }
}

.pstack-foot { display:flex; flex-direction:column; gap:8px; padding-top:16px; }
.pstack-foot-row { display:flex; flex-wrap:wrap; align-items:center; gap:8px 12px; }
.pstack-status { display:flex; align-items:center; gap:6px; min-width:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }
.pstack-status-text { color:var(--dsw-alias-label-secondary); }
.pstack-foot-actions { display:flex; gap:8px; align-items:center; margin-left:auto; }

.pstack-note { margin:0; font-size:13px; line-height:20px; color:var(--dsw-alias-label-tertiary); }
.pstack-banner { margin:0; border-radius:var(--dsw-radius-lg); padding:8px 10px; font-size:12px; line-height:18px; overflow-wrap:anywhere; }
.pstack-banner--warn { background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 8%, transparent); color:var(--dsw-alias-state-warn-label); }
.pstack-banner--ok { background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent); color:var(--dsw-alias-state-success-primary); }
.pstack-banner--error { background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent); color:var(--dsw-alias-state-error-primary); white-space:pre-wrap; }

@media (width <= 640px) {
  .pstack-row { grid-template-columns:1fr; }
  .pstack-panel-head { grid-template-columns:1fr; }
  .pstack-route-row { grid-template-columns:minmax(0,1fr) auto auto; }
  .pstack-index { display:none; }
}
`

function overlaysEqual(left: Overlay, right: Overlay): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function firstRoute(routes: readonly LiveRoute[]): OverlayRoute | undefined {
  const route = routes[0]
  if (route === undefined) return undefined
  return { provider: route.provider, model: route.model }
}

/**
 * DOM id for one role's controls. Role names carry a space and a comma, and an
 * id with either breaks the `aria-describedby` token list, so the name is slugged.
 */
function roleId(role: PstackRole): string {
  return role.replace(/[^a-z0-9]+/giu, '-').replace(/^-|-$/gu, '')
}

/**
 * Magnifier for the search field. Drawn here rather than imported: the shared
 * primitives module exports the glyph, but no Host bundle this plugin already
 * depends on is guaranteed to ship that export.
 */
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10.2 10.2 13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function RoleId({
  role,
  descId,
  t,
  trailing,
}: {
  role: PstackRole
  descId: string
  t: PstackSettingsInjected['t']
  /** Badge shown beside the role name; a panel role's route count or inherit state. */
  trailing?: ReactNode
}) {
  return (
    <div className="pstack-id">
      <span className="pstack-id-line">
        <code className="pstack-role">{role}</code>
        {trailing}
      </span>
      <span className="pstack-desc" id={descId}>{t(DESCRIPTION_KEY[role])}</span>
    </div>
  )
}

function EffortSelect({
  id,
  label,
  describedBy,
  route,
  live,
  t,
  disabled,
  onChange,
}: {
  id: string
  label: string
  describedBy: string
  route: OverlayRoute
  live: readonly LiveRoute[]
  t: PstackSettingsInjected['t']
  disabled: boolean
  onChange: (next: OverlayRoute) => void
}) {
  const found = liveFor(live, route.provider, route.model)
  if (found === undefined || found.efforts.length === 0) return <div className="pstack-spacer" />
  return (
    <select
      id={id}
      className="pstack-select"
      aria-label={label}
      aria-describedby={describedBy}
      value={route.reasoningEffort ?? ''}
      disabled={disabled}
      onChange={event => {
        const value = event.target.value
        onChange(value.length === 0
          ? { provider: route.provider, model: route.model }
          : { provider: route.provider, model: route.model, reasoningEffort: value })
      }}
    >
      <option value="">{t('effortOmit')}</option>
      {route.reasoningEffort !== undefined && !found.efforts.some(effort => effort.id === route.reasoningEffort)
        ? <option value={route.reasoningEffort} disabled>{route.reasoningEffort} · {t('unavailable')}</option>
        : null}
      {found.efforts.map(effort => (
        <option key={effort.id} value={effort.id}>{effort.name || effort.id}</option>
      ))}
    </select>
  )
}

function RouteSelect({
  id,
  label,
  describedBy,
  value,
  live,
  t,
  disabled,
  onChange,
}: {
  id?: string
  label: string
  describedBy?: string
  value: string
  live: readonly LiveRoute[]
  t: PstackSettingsInjected['t']
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <select
      id={id}
      className="pstack-select"
      aria-label={label}
      aria-describedby={describedBy}
      value={value}
      disabled={disabled}
      onChange={event => { onChange(event.target.value) }}
    >
      <option value="inherit-parent">{t('inheritParent')}</option>
      {value !== 'inherit-parent' && value !== 'auto' && !live.some(route => routeKey(route.provider, route.model) === value)
        ? <option value={value} disabled>{value.replace('::', '/')} · {t('unavailable')}</option>
        : null}
      {live.map(route => {
        const key = routeKey(route.provider, route.model)
        return (
          <option key={key} value={key}>
            {route.provider}/{route.model}
          </option>
        )
      })}
    </select>
  )
}

export function PstackSettings({ t, subscribeCatalogChanges }: PstackSettingsProps) {
  const [drafts, setDrafts] = useState<RoleDraft[] | undefined>(undefined)
  const [saved, setSaved] = useState<Overlay | undefined>(undefined)
  const [savedDefault, setSavedDefault] = useState<boolean | undefined>(undefined)
  const [draftDefault, setDraftDefault] = useState<boolean | undefined>(undefined)
  const [live, setLive] = useState<readonly LiveRoute[]>([])
  const [dropped, setDropped] = useState<string[]>([])
  const [error, setError] = useState<string | undefined>(undefined)
  const [catalogError, setCatalogError] = useState<string | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [query, setQuery] = useState('')
  const initialized = useRef(false)
  const catalogRequest = useRef<AbortController | undefined>(undefined)

  const refresh = useCallback(async () => {
    catalogRequest.current?.abort()
    const request = new AbortController()
    catalogRequest.current = request
    setRefreshing(true)
    try {
      const snapshot = await loadSettingsSnapshot(request.signal)
      if (request.signal.aborted) return
      setLive(snapshot.catalog.routes)
      // Login and model notifications must never replace the user's in-progress
      // role choices (or the baseline that decides whether Save is enabled).
      if (!initialized.current) {
        setSaved(snapshot.overlay)
        setDrafts(overlayToDraft(snapshot.overlay))
        setSavedDefault(snapshot.potetoDefault)
        setDraftDefault(snapshot.potetoDefault)
        setDropped(snapshot.droppedRoles)
        initialized.current = true
      }
      setCatalogError(undefined)
    } catch (caught: unknown) {
      if (!request.signal.aborted) {
        setCatalogError(caught instanceof Error ? caught.message : t('requestFailed'))
      }
    } finally {
      // A newer request owns the flag once it starts; only the latest one clears it.
      if (catalogRequest.current === request) setRefreshing(false)
    }
  }, [t])

  // The page mounts this form while the bundle's page is open, so leaving it
  // drops the staged edits and stops the catalog subscriptions.
  useEffect(() => {
    const reload = () => { void refresh() }
    const visible = () => { if (document.visibilityState === 'visible') reload() }
    const stop = subscribeCatalogChanges(reload)
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', visible)
    reload()
    return () => {
      stop()
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', visible)
      catalogRequest.current?.abort()
    }
  }, [refresh, subscribeCatalogChanges])

  const currentOverlay = useMemo(() => drafts === undefined ? undefined : draftToOverlay(drafts), [drafts])
  const rolesDirty = saved !== undefined && currentOverlay !== undefined && !overlaysEqual(saved, currentOverlay)
  const defaultDirty = savedDefault !== undefined && draftDefault !== undefined && savedDefault !== draftDefault
  const dirty = rolesDirty || defaultDirty
  const empty = live.length === 0
  const configured = drafts === undefined
    ? 0
    : drafts.filter(draft => VISIBLE_ROLES.includes(draft.role) && !draft.inherit && draft.routes.length > 0).length
  const total = VISIBLE_ROLES.length

  const patchRole = (role: PstackRole, update: (draft: RoleDraft) => RoleDraft): void => {
    setDrafts(current => current?.map(draft => draft.role === role ? update(draft) : draft))
    setNotice(undefined)
    setError(undefined)
  }

  const setScalarChoice = (role: PstackRole, value: string): void => {
    const parsed = parseRouteSelectValue(value, live)
    patchRole(role, draft => {
      if (parsed.inherit) {
        return { ...draft, inherit: true, inheritChoice: parsed.inheritChoice, routes: [] }
      }
      return { ...draft, inherit: false, inheritChoice: 'inherit-parent', routes: [stripIllegalEffort(parsed.route, live)] }
    })
  }

  const setPanelChoice = (role: PstackRole, index: number, value: string): void => {
    const parsed = parseRouteSelectValue(value, live)
    patchRole(role, draft => {
      if (parsed.inherit) {
        return { ...draft, inherit: true, inheritChoice: parsed.inheritChoice, routes: [] }
      }
      const routes = draft.inherit ? [] : [...draft.routes]
      routes[index] = stripIllegalEffort(parsed.route, live)
      return { ...draft, inherit: false, inheritChoice: 'inherit-parent', routes }
    })
  }

  const save = async (): Promise<void> => {
    if (currentOverlay === undefined || draftDefault === undefined) return
    setBusy(true)
    setNotice(undefined)
    setError(undefined)
    const failures: string[] = []
    let savedAny = false
    if (rolesDirty) {
      try {
        const result = await saveSettingsOverlay(currentOverlay)
        setSaved(result.overlay)
        setDrafts(overlayToDraft(result.overlay))
        setDropped([])
        savedAny = true
      } catch (caught: unknown) {
        failures.push(`${t('title')}: ${caught instanceof Error ? caught.message : t('requestFailed')}`)
      }
    }
    if (defaultDirty) {
      try {
        const result = await saveSettingsDefault(draftDefault)
        setSavedDefault(result.potetoDefault)
        setDraftDefault(result.potetoDefault)
        savedAny = true
      } catch (caught: unknown) {
        failures.push(`${t('defaultsTitle')}: ${caught instanceof Error ? caught.message : t('requestFailed')}`)
      }
    }
    if (failures.length > 0) {
      setError([...(savedAny ? [t('partiallySaved')] : []), ...failures].join('\n'))
    } else {
      setNotice(t('saved'))
    }
    setBusy(false)
  }

  const discard = (): void => {
    if (saved === undefined) return
    setDrafts(overlayToDraft(saved))
    setDraftDefault(savedDefault)
    setDropped([])
    setNotice(undefined)
    setError(undefined)
  }

  const matches = (role: PstackRole): boolean => {
    if (query.trim().length === 0) return true
    const needle = query.trim().toLowerCase()
    if (role.includes(needle)) return true
    if (t(DESCRIPTION_KEY[role]).toLowerCase().includes(needle)) return true
    const draft = drafts?.find(entry => entry.role === role)
    return draft?.routes.some(route =>
      `${route.provider}/${route.model}`.toLowerCase().includes(needle)
      || route.reasoningEffort?.toLowerCase().includes(needle)) === true
  }

  return (
    <section
      className="pstack-page"
      aria-busy={busy || refreshing}
    >
      <style>{SETTINGS_CSS}</style>

      <div className="pstack-head">
        <div className="pstack-section-head">
          <h3 className="pstack-section-title">{t('title')}</h3>
          {drafts === undefined
            ? null
            : <span className="pstack-section-count">{t('configured', { configured, total })}</span>}
        </div>
        <p className="pstack-intro">{t('intro')}</p>
      </div>

      {drafts === undefined
        ? catalogError === undefined
          ? <p className="pstack-note" role="status" aria-busy="true">{t('loading')}</p>
          : (
              <>
                <p className="pstack-banner pstack-banner--error" role="alert">{catalogError}</p>
                <div className="pstack-inline">
                  <Button variant="outline" size="sm" onClick={() => { void refresh() }}>{t('reload')}</Button>
                </div>
              </>
            )
        : (
            <>
              <div className="pstack-tools">
                <span className="pstack-search">
                  <SearchIcon />
                  <input
                    type="search"
                    placeholder={t('search')}
                    aria-label={t('search')}
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                  />
                </span>
                {!empty
                  ? (
                      <select
                        className="pstack-select pstack-select--auto"
                        aria-label={t('applyAll')}
                        defaultValue=""
                        disabled={busy}
                        onChange={event => {
                          const value = event.target.value
                          event.target.value = ''
                          if (value.length === 0) return
                          if (value === 'inherit-parent') {
                            setDrafts(current => current === undefined ? current : applyInheritAll(current))
                            return
                          }
                          const parsed = parseRouteSelectValue(value, live)
                          if (parsed.inherit) {
                            setDrafts(current => current === undefined ? current : applyInheritAll(current, parsed.inheritChoice))
                            return
                          }
                          setDrafts(current => current === undefined ? current : applyRouteToAll(current, parsed.route, live))
                        }}
                      >
                        <option value="">{t('applyAll')}</option>
                        <option value="inherit-parent">{t('applyAllInherit')}</option>
                        {live.map(route => {
                          const key = routeKey(route.provider, route.model)
                          return <option key={key} value={key}>{route.provider}/{route.model}</option>
                        })}
                      </select>
                    )
                  : null}
                <Button
                  variant="outline"
                  size="sm"
                  title={t('catalogUpdates')}
                  disabled={busy || refreshing}
                  onClick={() => { void refresh() }}
                >
                  {refreshing ? t('reloading') : t('reload')}
                </Button>
              </div>

              <section className="pstack-defaults" aria-label={t('defaultsTitle')}>
                <h3 className="pstack-group-title">{t('defaultsTitle')}</h3>
                <div className="pstack-default-row">
                  <div className="pstack-default-text">
                    <span className="pstack-default-label">{t('potetoDefaultLabel')}</span>
                    <span className="pstack-default-desc">{t('potetoDefaultDescription')}</span>
                  </div>
                  <Switch
                    checked={draftDefault ?? false}
                    disabled={busy || draftDefault === undefined}
                    label={t('potetoDefaultLabel')}
                    onChange={next => {
                      setDraftDefault(next)
                      setNotice(undefined)
                      setError(undefined)
                    }}
                  />
                </div>
              </section>

              {catalogError !== undefined
                ? <p className="pstack-banner pstack-banner--error" role="alert">{catalogError}</p>
                : null}
              {empty ? <p className="pstack-banner pstack-banner--warn">{t('emptyCatalog')}</p> : null}
              {dropped.length > 0 ? <p className="pstack-banner pstack-banner--warn">{t('dropped')}</p> : null}

              {GROUPS.map(group => {
                const roles = group.roles.filter(matches)
                if (roles.length === 0) return null
                return (
                  <section key={group.id} className="pstack-group" aria-label={t(group.id)}>
                    <div className="pstack-group-head">
                      <h3 className="pstack-group-title">{t(group.id)}</h3>
                      <span className="pstack-group-count">{roles.length}</span>
                    </div>
                    {group.id === 'groupPanels' ? <p className="pstack-hint">{t('panelHint')}</p> : null}
                    <div className="pstack-card">
                      {roles.map(role => {
                        const draft = drafts.find(entry => entry.role === role)
                        if (draft === undefined) return null
                        const controlId = roleId(role)
                        if (!draft.panel) {
                          const route = draft.routes[0]
                          return (
                            <div key={role} className="pstack-row">
                              <RoleId role={role} descId={`pstack-desc-${controlId}`} t={t} />
                              <RouteSelect
                                id={`pstack-role-${controlId}`}
                                describedBy={`pstack-desc-${controlId}`}
                                label={`${role} · ${t('route')}`}
                                value={routeSelectValue(draft)}
                                live={live}
                                t={t}
                                disabled={busy}
                                onChange={value => { setScalarChoice(role, value) }}
                              />
                              {route !== undefined && !draft.inherit
                                ? (
                                    <EffortSelect
                                      id={`pstack-effort-${controlId}`}
                                      label={`${role} · ${t('effort')}`}
                                      describedBy={`pstack-desc-${controlId}`}
                                      route={route}
                                      live={live}
                                      t={t}
                                      disabled={busy}
                                      onChange={next => { patchRole(role, current => ({ ...current, routes: [next] })) }}
                                    />
                                  )
                                : <div className="pstack-spacer" />}
                            </div>
                          )
                        }
                        const rows = draft.inherit ? [] : draft.routes
                        return (
                          <div key={role}>
                            <div className="pstack-panel-head">
                              <RoleId
                                role={role}
                                descId={`pstack-desc-${controlId}`}
                                t={t}
                                trailing={
                                  <Tag tone={draft.inherit ? 'quiet' : 'neutral'}>
                                    {draft.inherit ? t('inherit') : t('panelRoutes', { count: rows.length })}
                                  </Tag>
                                }
                              />
                              {draft.inherit
                                ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={busy || empty}
                                      onClick={() => {
                                        const added = firstRoute(live)
                                        if (added === undefined) return
                                        patchRole(role, current => ({ ...current, inherit: false, routes: [added] }))
                                      }}
                                    >
                                      {t('configureRoutes')}
                                    </Button>
                                  )
                                : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={busy}
                                      onClick={() => {
                                        patchRole(role, current => ({ ...current, inherit: true, inheritChoice: 'inherit-parent', routes: [] }))
                                      }}
                                    >
                                      {t('inherit')}
                                    </Button>
                                  )}
                            </div>
                            {draft.inherit
                              ? null
                              : (
                                  <div className="pstack-panel-body">
                                    {rows.map((route, index) => (
                                      <div key={`${role}-${index}`} className="pstack-route-row">
                                        <span className="pstack-index" aria-hidden="true">{index + 1}</span>
                                        <RouteSelect
                                          id={`pstack-panel-${controlId}-${index}`}
                                          label={`${role} ${index + 1} · ${t('route')}`}
                                          describedBy={`pstack-desc-${controlId}`}
                                          value={routeSelectValue({ ...draft, inherit: false, routes: [route] })}
                                          live={live}
                                          t={t}
                                          disabled={busy || empty}
                                          onChange={value => { setPanelChoice(role, index, value) }}
                                        />
                                        <EffortSelect
                                          id={`pstack-panel-effort-${controlId}-${index}`}
                                          label={`${role} ${index + 1} · ${t('effort')}`}
                                          describedBy={`pstack-desc-${controlId}`}
                                          route={route}
                                          live={live}
                                          t={t}
                                          disabled={busy}
                                          onChange={next => {
                                            patchRole(role, current => {
                                              const nextRoutes = [...current.routes]
                                              nextRoutes[index] = next
                                              return { ...current, inherit: false, routes: nextRoutes }
                                            })
                                          }}
                                        />
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="pstack-remove"
                                          icon={<IconTrashOutlineRegular size={14} aria-hidden="true" />}
                                          aria-label={t('removeRoute')}
                                          title={t('removeRoute')}
                                          disabled={busy}
                                          onClick={() => {
                                            patchRole(role, current => {
                                              const nextRoutes = current.routes.filter((_, item) => item !== index)
                                              return nextRoutes.length === 0
                                                ? { ...current, inherit: true, routes: [] }
                                                : { ...current, inherit: false, routes: nextRoutes }
                                            })
                                          }}
                                        />
                                      </div>
                                    ))}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="pstack-add"
                                      title={t('addRouteHint')}
                                      icon={<IconPlusOutlineRegular size={14} aria-hidden="true" />}
                                      disabled={busy || empty}
                                      onClick={() => {
                                        const added = firstRoute(live)
                                        if (added === undefined) return
                                        patchRole(role, current => ({
                                          ...current,
                                          inherit: false,
                                          routes: [...(current.inherit ? [] : current.routes), added],
                                        }))
                                      }}
                                    >
                                      {t('addRoute')}
                                    </Button>
                                  </div>
                                )}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
              {GROUPS.every(group => group.roles.filter(matches).length === 0)
                ? <p className="pstack-note">{t('noMatch')}</p>
                : null}

              <footer className="pstack-foot">
                {error !== undefined ? <p className="pstack-banner pstack-banner--error" role="alert">{error}</p> : null}
                {notice !== undefined ? <p className="pstack-banner pstack-banner--ok" role="status">{notice}</p> : null}
                <div className="pstack-foot-row">
                  <div className="pstack-status" role="status" aria-live="polite">
                    <StateDot state={dirty ? 'warning' : 'idle'} />
                    <span className="pstack-status-text">{dirty ? t('dirty') : t('clean')}</span>
                  </div>
                  <div className="pstack-foot-actions">
                    <Button variant="ghost" size="md" disabled={busy || !dirty} onClick={discard}>
                      {t('discard')}
                    </Button>
                    <Button variant="primary" size="md" disabled={busy || !dirty} onClick={() => { void save() }}>
                      {busy ? t('saving') : t('save')}
                    </Button>
                  </div>
                </div>
              </footer>
            </>
          )}
    </section>
  )
}
