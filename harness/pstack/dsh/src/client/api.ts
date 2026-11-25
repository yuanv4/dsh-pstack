import type { CatalogResult } from '../catalog-types.ts'
import type { Overlay } from '../overlay-model.ts'
import { POTETO_STATE_PATH, SETTINGS_SAVE_PATH, SETTINGS_SNAPSHOT_PATH } from '../ids.ts'

export interface SettingsSnapshot {
  catalog: CatalogResult
  overlay: Overlay
  path: string
  missing: boolean
  droppedRoles: string[]
  /** Whether a newly created session starts with the poteto workflow on. */
  potetoDefault: boolean
}

export interface SettingsSaveResult {
  path: string
  overlay: Overlay
}

type CatalogEvent = 'llm/adapters-updated' | 'llm/models-updated' | 'settings/document-updated' | 'credentials/reference-updated'

export interface CatalogEventContext {
  remote: { $on(event: CatalogEvent, listener: () => void): () => void }
  on(event: 'connection/reset', listener: () => void): () => void
}

/** Use the same Host notifications as DSH's model directory, scoped to the open settings page. */
export function listenForCatalogChanges(ctx: CatalogEventContext, listener: () => void): () => void {
  const disposers = [
    ctx.remote.$on('llm/adapters-updated', listener),
    ctx.remote.$on('llm/models-updated', listener),
    ctx.remote.$on('settings/document-updated', listener),
    ctx.remote.$on('credentials/reference-updated', listener),
    ctx.on('connection/reset', listener),
  ]
  return () => { for (const dispose of disposers) dispose() }
}

async function jsonRequest<T>(path: string, method: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: { accept: 'application/json', ...body === undefined ? {} : { 'content-type': 'application/json' } },
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
    ...body === undefined ? {} : { body: JSON.stringify(body) },
  })
  const value: unknown = await response.json().catch(() => undefined)
  if (!response.ok) {
    const message = typeof value === 'object' && value !== null && 'error' in value && typeof (value as { error: unknown }).error === 'string'
      ? (value as { error: string }).error
      : `HTTP ${response.status}`
    throw new Error(message)
  }
  return value as T
}

export function loadSettingsSnapshot(signal?: AbortSignal): Promise<SettingsSnapshot> {
  return jsonRequest<SettingsSnapshot>(SETTINGS_SNAPSHOT_PATH, 'GET', undefined, signal)
}

export function saveSettingsOverlay(overlay: Overlay): Promise<SettingsSaveResult> {
  return jsonRequest<SettingsSaveResult>(SETTINGS_SAVE_PATH, 'PUT', { overlay })
}

export function saveSettingsDefault(potetoDefault: boolean): Promise<{ potetoDefault: boolean }> {
  return jsonRequest<{ potetoDefault: boolean }>(SETTINGS_SAVE_PATH, 'PUT', { potetoDefault })
}

export interface PotetoState {
  readonly enabled: boolean
  readonly denied: string[]
}

export function readPotetoState(sessionId: string, signal?: AbortSignal): Promise<PotetoState> {
  return jsonRequest<PotetoState>(`${POTETO_STATE_PATH}?session=${encodeURIComponent(sessionId)}`, 'GET', undefined, signal)
}

export function setPotetoState(sessionId: string, enabled: boolean): Promise<PotetoState> {
  return jsonRequest<PotetoState>(POTETO_STATE_PATH, 'POST', { session: sessionId, enabled })
}