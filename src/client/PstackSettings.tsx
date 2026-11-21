/** pstack role editor, rendered inside the plugin detail dialog. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { loadSettingsSnapshot, saveSettingsOverlay } from './api.ts'
import type { PstackSettingsKey } from './locales.ts'

export interface PstackSettingsInjected {
  t: (key: PstackSettingsKey, params?: Record<string, unknown>) => string
  subscribeCatalogChanges: (listener: () => void) => () => void
}

export type PstackSettingsProps = Partial<PstackSettingsInjected> & {
  /** False while the host dialog is closed: keep the draft, stop listening and polling. */
  active?: boolean
}

type GroupKey = 'groupPlaybooks' | 'groupSkills' | 'groupVerify' | 'groupPanels'

const GROUPS: { id: GroupKey; roles: readonly PstackRole[] }[] = [
  { id: 'groupPlaybooks', roles: ['feature', 'refactoring', 'bug-fix', 'perf-issue', 'hillclimb', 'judgment-and-prose', 'hardest-tasks'] },
  { id: 'groupSkills', roles: ['how-explorer', 'how-explainer', 'why-investigators', 'why-synthesizer', 'reflect-tooling', 'reflect-judgment', 'swarm-workers'] },
  { id: 'groupVerify', roles: ['independent-verifier', 'poteto-agent', 'comment-sicko'] },
  { id: 'groupPanels', roles: PANEL_ROLES.filter(role => role !== 'how-critics') },
]

const VISIBLE_ROLES = GROUPS.flatMap(group => group.roles)

const DESCRIPTION_KEY = {
  feature: 'descFeature',
  refactoring: 'descRefactoring',
  'bug-fix': 'descBugFix',
  'perf-issue': 'descPerfIssue',
  hillclimb: 'descHillclimb',
  'judgment-and-prose': 'descJudgment',
  'hardest-tasks': 'descHardest',
  'how-explorer': 'descHowExplorer',
  'how-explainer': 'descHowExplainer',
  'why-investigators': 'descWhyInvestigators',
  'why-synthesizer': 'descWhySynthesizer',
  'reflect-tooling': 'descReflectTooling',
  'reflect-judgment': 'descReflectJudgment',
  'swarm-workers': 'descSwarmWorkers',
  'independent-verifier': 'descIndependentVerifier',
  'poteto-agent': 'descPotetoAgent',
  'comment-sicko': 'descCommentSicko',
  'how-critics': 'descHowCritics',
  'arena-runners': 'descArenaRunners',
  'arena-cross-judge-pool': 'descArenaJudge',
  'architect-runners': 'descArchitectRunners',
  'interrogate-reviewers': 'descInterrogateReviewers',
} as const satisfies Record<PstackRole, PstackSettingsKey>

const SETTINGS_CSS = `
.pstack-page { display:flex; flex-direction:column; flex:1 0 auto; color:var(--dsw-alias-label-primary); }
.pstack-page .pstack-button {
  flex:none; min-height:32px; padding:0 12px; border:1px solid transparent; border-radius:8px;
  background:transparent; color:var(--dsw-alias-label-primary); font:inherit; font-size:13px; cursor:pointer;
  white-space:nowrap;
}
.pstack-page .pstack-button--primary { background:var(--dsw-alias-button-primary-fill); color:var(--dsw-alias-label-primary-inverted); }
.pstack-page .pstack-button--outline { border-color:var(--dsw-alias-border-l2); }
.pstack-page .pstack-button--ghost { color:var(--dsw-alias-label-secondary); }
.pstack-page .pstack-button:focus-visible { outline:var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset:2px; }
.pstack-page .pstack-button:disabled { cursor:default; opacity:.45; }
@media (hover:hover) {
  .pstack-page .pstack-button--ghost:not(:disabled):hover,
  .pstack-page .pstack-button--outline:not(:disabled):hover { background:var(--dsw-alias-interactive-bg-hover); }
  .pstack-page .pstack-button--primary:not(:disabled):hover { background:var(--dsw-alias-button-primary-hover); }
}
.pstack-page .pstack-button:not(:disabled):active { background:var(--dsw-alias-interactive-bg-active); }

.pstack-page .pstack-tools {
  position:sticky; top:0; z-index:2; display:flex; flex-wrap:wrap; gap:8px; align-items:center;
  padding:10px 16px; background:var(--dsw-alias-bg-layer-2);
  border-bottom:0.5px solid var(--dsw-alias-border-l2);
}
.pstack-page .pstack-search {
  flex:1 1 180px; min-width:120px; height:32px; padding:0 10px; border:1px solid var(--dsw-alias-border-l2);
  border-radius:8px; background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary);
  font:inherit; font-size:13px;
}
.pstack-page .pstack-search::placeholder { color:var(--dsw-alias-label-tertiary); }
.pstack-page .pstack-search:focus-visible { outline:var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset:-1px; }

.pstack-page .pstack-list { display:flex; flex-direction:column; flex:1 0 auto; gap:18px; padding:16px; }
.pstack-page .pstack-group { display:flex; flex-direction:column; gap:6px; }
.pstack-page .pstack-group-head { display:flex; align-items:baseline; gap:8px; padding:0 2px; }
.pstack-page .pstack-group-title { margin:0; font-size:12px; line-height:18px; font-weight:500; color:var(--dsw-alias-label-secondary); }
.pstack-page .pstack-group-count { font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }

.pstack-page .pstack-card {
  border:0.5px solid var(--dsw-alias-settings-card-stroke); border-radius:var(--dsw-radius-md, 10px);
  background:var(--dsw-alias-settings-card-fill); overflow:hidden;
}
.pstack-page .pstack-card > * + * { border-top:0.5px solid var(--dsw-alias-border-l1); }

.pstack-page .pstack-row {
  display:grid; grid-template-columns:minmax(150px,1fr) minmax(170px,1.35fr) minmax(104px,132px);
  gap:10px; align-items:center; padding:7px 12px;
}
.pstack-page .pstack-id { display:flex; flex-direction:column; gap:1px; min-width:0; }
.pstack-page .pstack-role {
  font-size:13px; line-height:18px; font-weight:500; color:var(--dsw-alias-label-primary);
  font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.pstack-page .pstack-desc { font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.pstack-page .pstack-select {
  width:100%; height:32px; min-width:0; padding:0 8px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px;
  background:var(--dsw-alias-bg-layer-3); color:var(--dsw-alias-label-primary); font:inherit; font-size:13px;
}
.pstack-page .pstack-select:focus-visible { outline:var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset:-1px; }
.pstack-page .pstack-select:disabled { color:var(--dsw-alias-label-tertiary); cursor:default; }
.pstack-page .pstack-spacer { min-height:1px; }
.pstack-page .pstack-inline { display:flex; gap:6px; align-items:center; min-width:0; }

.pstack-page .pstack-panel-head {
  display:grid; grid-template-columns:minmax(150px,1fr) auto auto; gap:10px; align-items:center; padding:7px 12px;
}
.pstack-page .pstack-panel-head-main { display:flex; align-items:center; gap:8px; min-width:0; }
.pstack-page .pstack-badge {
  flex:none; padding:1px 7px; border-radius:999px; font-size:12px; line-height:18px;
  color:var(--dsw-alias-label-secondary); background:var(--dsw-alias-bg-layer-3);
}
.pstack-page .pstack-panel-body { display:flex; flex-direction:column; gap:6px; padding:8px 12px 10px 24px; background:var(--dsw-alias-bg-layer-1); }
.pstack-page .pstack-route-row { display:grid; grid-template-columns:18px minmax(120px,1fr) minmax(96px,124px) auto; gap:8px; align-items:center; }
.pstack-page .pstack-index { font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); text-align:right; }
.pstack-page .pstack-remove {
  flex:none; width:28px; height:28px; padding:0; border:1px solid transparent; border-radius:var(--dsw-radius-sm, 6px);
  background:transparent; color:var(--dsw-alias-label-tertiary); font:inherit; font-size:15px; line-height:1; cursor:pointer;
}
@media (hover:hover) { .pstack-page .pstack-remove:hover { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); } }
.pstack-page .pstack-remove:focus-visible { outline:var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-brand-primary)); outline-offset:1px; }

.pstack-page .pstack-foot {
  position:sticky; bottom:0; z-index:2; margin-top:auto;
  display:flex; flex-wrap:wrap; gap:10px; align-items:center;
  justify-content:space-between; padding:10px 16px;
  background:var(--dsw-alias-bg-layer-2); border-top:0.5px solid var(--dsw-alias-border-l2);
}
.pstack-page .pstack-status { display:flex; align-items:center; gap:8px; min-width:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }
.pstack-page .pstack-dot { flex:none; width:6px; height:6px; border-radius:50%; background:var(--dsw-alias-state-idle-primary); }
.pstack-page .pstack-dot--dirty { background:var(--dsw-alias-state-warn-primary); }
.pstack-page .pstack-status-text { color:var(--dsw-alias-label-secondary); }
.pstack-page .pstack-path { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:240px; }
.pstack-page .pstack-foot-error { flex:1 1 100%; margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-state-error-primary); white-space:pre-wrap; }
.pstack-page .pstack-foot-ok { flex:1 1 100%; margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-state-success-primary); }
.pstack-page .pstack-select--auto { width:auto; }
.pstack-page .pstack-hint { margin:0; padding:0 2px; font-size:12px; line-height:18px; color:var(--dsw-alias-label-tertiary); }
.pstack-page .pstack-foot-actions { display:flex; gap:8px; align-items:center; margin-left:auto; }

.pstack-page .pstack-note { margin:0; padding:16px; font-size:13px; line-height:20px; color:var(--dsw-alias-label-tertiary); }
.pstack-page .pstack-warn { margin:0; padding:8px 16px; font-size:12px; line-height:18px; color:var(--dsw-alias-state-warn-label); }
.pstack-page .pstack-error { margin:0; padding:8px 16px; font-size:12px; line-height:18px; color:var(--dsw-alias-state-error-primary); white-space:pre-wrap; }

@media (width <= 720px) {
  .pstack-page .pstack-row { grid-template-columns:1fr; }
  .pstack-page .pstack-panel-head { grid-template-columns:1fr; }
  .pstack-page .pstack-route-row { grid-template-columns:minmax(0,1fr) auto auto; }
  .pstack-page .pstack-index { display:none; }
  .pstack-page .pstack-path { display:none; }
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

function RoleId({ role, descId, t }: { role: PstackRole; descId: string; t: PstackSettingsInjected['t'] }) {
  return (
    <div className="pstack-id">
      <code className="pstack-role">{role}</code>
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

export function PstackSettings({ t, subscribeCatalogChanges, active = true }: PstackSettingsProps) {
  if (t === undefined) throw new Error('pstack settings requires its translation function')
  const [drafts, setDrafts] = useState<RoleDraft[] | undefined>(undefined)
  const [saved, setSaved] = useState<Overlay | undefined>(undefined)
  const [live, setLive] = useState<readonly LiveRoute[]>([])
  const [path, setPath] = useState<string>('')
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
      setPath(snapshot.path)
      // Login and model notifications must never replace the user's in-progress
      // role choices (or the baseline that decides whether Save is enabled).
      if (!initialized.current) {
        setSaved(snapshot.overlay)
        setDrafts(overlayToDraft(snapshot.overlay))
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

  useEffect(() => {
    if (!active) return
    const reload = () => { void refresh() }
    const visible = () => { if (document.visibilityState === 'visible') reload() }
    const stop = subscribeCatalogChanges?.(reload)
    window.addEventListener('focus', reload)
    document.addEventListener('visibilitychange', visible)
    reload()
    return () => {
      stop?.()
      window.removeEventListener('focus', reload)
      document.removeEventListener('visibilitychange', visible)
      catalogRequest.current?.abort()
    }
  }, [refresh, subscribeCatalogChanges, active])

  const currentOverlay = useMemo(() => drafts === undefined ? undefined : draftToOverlay(drafts), [drafts])
  const dirty = saved !== undefined && currentOverlay !== undefined && !overlaysEqual(saved, currentOverlay)
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
    if (currentOverlay === undefined) return
    setBusy(true)
    setNotice(undefined)
    setError(undefined)
    try {
      const result = await saveSettingsOverlay(currentOverlay)
      setSaved(result.overlay)
      setDrafts(overlayToDraft(result.overlay))
      setDropped([])
      setError(undefined)
      setNotice(t('saved'))
    } catch (caught: unknown) {
      setNotice(undefined)
      setError(caught instanceof Error ? caught.message : t('requestFailed'))
    } finally {
      setBusy(false)
    }
  }

  const discard = (): void => {
    if (saved === undefined) return
    setDrafts(overlayToDraft(saved))
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
      onFocusCapture={event => { if (event.target instanceof HTMLSelectElement) void refresh() }}
      onPointerDownCapture={event => { if (event.target instanceof HTMLSelectElement) void refresh() }}
    >
      <style>{SETTINGS_CSS}</style>

      {drafts === undefined
        ? catalogError === undefined
          ? <p className="pstack-note" role="status" aria-busy="true">{t('loading')}</p>
          : (
              <>
                <p className="pstack-error" role="alert">{catalogError}</p>
                <p className="pstack-note">
                  <button type="button" className="pstack-button pstack-button--outline" onClick={() => { void refresh() }}>{t('reload')}</button>
                </p>
              </>
            )
        : (
            <>
              <div className="pstack-tools">
                <input
                  autoFocus
                  type="search"
                  className="pstack-search"
                  placeholder={t('search')}
                  aria-label={t('search')}
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                />
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
                <button
                  type="button"
                  className="pstack-button pstack-button--outline"
                  title={t('catalogUpdates')}
                  aria-busy={refreshing}
                  disabled={busy || refreshing}
                  onClick={() => { void refresh() }}
                >
                  {refreshing ? t('reloading') : t('reload')}
                </button>
              </div>

              {catalogError !== undefined ? <p className="pstack-error" role="alert">{catalogError}</p> : null}
              {empty ? <p className="pstack-warn">{t('emptyCatalog')}</p> : null}
              {dropped.length > 0 ? <p className="pstack-warn">{t('dropped')}</p> : null}

              <div className="pstack-list">
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
                          if (!draft.panel) {
                            const route = draft.routes[0]
                            return (
                              <div key={role} className="pstack-row">
                                <RoleId role={role} descId={`pstack-desc-${role}`} t={t} />
                                <RouteSelect
                                  id={`pstack-role-${role}`}
                                  describedBy={`pstack-desc-${role}`}
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
                                        id={`pstack-effort-${role}`}
                                        label={`${role} · ${t('effort')}`}
                                        describedBy={`pstack-desc-${role}`}
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
                                <div className="pstack-panel-head-main">
                                  <RoleId role={role} descId={`pstack-desc-${role}`} t={t} />
                                  <span className="pstack-badge">
                                    {draft.inherit ? t('inherit') : t('panelRoutes', { count: rows.length })}
                                  </span>
                                </div>
                                {draft.inherit
                                  ? (
                                      <RouteSelect
                                        label={`${role} · ${t('route')}`}
                                        value={draft.inheritChoice}
                                        live={[]}
                                        t={t}
                                        disabled={busy}
                                        onChange={value => {
                                          if (value === 'inherit-parent' || value === 'auto') {
                                            patchRole(role, current => ({ ...current, inherit: true, inheritChoice: value, routes: [] }))
                                          }
                                        }}
                                      />
                                    )
                                  : <span className="pstack-spacer" />}
                                {draft.inherit
                                  ? (
                                      <button
                                        type="button"
                                        className="pstack-button pstack-button--ghost"
                                        disabled={busy || empty}
                                        onClick={() => {
                                          const added = firstRoute(live)
                                          if (added === undefined) return
                                          patchRole(role, current => ({ ...current, inherit: false, routes: [added] }))
                                        }}
                                      >
                                        {t('configureRoutes')}
                                      </button>
                                    )
                                  : (
                                      <button
                                        type="button"
                                        className="pstack-button pstack-button--ghost"
                                        disabled={busy}
                                        onClick={() => {
                                          patchRole(role, current => ({ ...current, inherit: true, inheritChoice: 'inherit-parent', routes: [] }))
                                        }}
                                      >
                                        {t('inherit')}
                                      </button>
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
                                            id={`pstack-panel-${role}-${index}`}
                                            label={`${role} ${index + 1} · ${t('route')}`}
                                            describedBy={`pstack-desc-${role}`}
                                            value={routeSelectValue({ ...draft, inherit: false, routes: [route] })}
                                            live={live}
                                            t={t}
                                            disabled={busy || empty}
                                            onChange={value => { setPanelChoice(role, index, value) }}
                                          />
                                          <EffortSelect
                                            id={`pstack-panel-effort-${role}-${index}`}
                                            label={`${role} ${index + 1} · ${t('effort')}`}
                                            describedBy={`pstack-desc-${role}`}
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
                                          <button
                                            type="button"
                                            className="pstack-remove"
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
                                          >
                                            ×
                                          </button>
                                        </div>
                                      ))}
                                      <div className="pstack-inline">
                                        <button
                                          type="button"
                                          className="pstack-button pstack-button--outline"
                                          title={t('addRouteHint')}
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
                                        </button>
                                      </div>
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
              </div>

              <footer className="pstack-foot">
                <div className="pstack-status" role="status" aria-live="polite">
                  <span className={`pstack-dot${dirty ? ' pstack-dot--dirty' : ''}`} aria-hidden="true" />
                  <span className="pstack-status-text">{dirty ? t('dirty') : t('clean')}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t('configured', { configured, total })}</span>
                  {path.length > 0
                    ? <span className="pstack-path" title={`${t('overlayPath')}: ${path}`}>{path}</span>
                    : null}
                </div>
                {error !== undefined ? <p className="pstack-foot-error" role="alert">{error}</p> : null}
                {notice !== undefined ? <p className="pstack-foot-ok" role="status">{notice}</p> : null}
                <div className="pstack-foot-actions">
                  <button type="button" className="pstack-button pstack-button--ghost" disabled={busy || !dirty} onClick={discard}>
                    {t('discard')}
                  </button>
                  <button
                    type="button"
                    className="pstack-button pstack-button--outline"
                    disabled={busy}
                    onClick={() => {
                      setDrafts(current => current === undefined ? current : applyInheritAll(current))
                      setNotice(undefined)
                    }}
                  >
                    {t('resetAll')}
                  </button>
                  <button type="button" className="pstack-button pstack-button--primary" disabled={busy || !dirty} onClick={() => { void save() }}>
                    {busy ? t('saving') : t('save')}
                  </button>
                </div>
              </footer>
            </>
          )}
    </section>
  )
}
