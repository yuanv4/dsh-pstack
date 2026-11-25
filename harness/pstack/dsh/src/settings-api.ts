import type { CatalogHost } from './catalog.ts'
import { buildCatalog } from './catalog.ts'
import type { CatalogResult } from './catalog-types.ts'
import {
  parseOverlay,
  readOverlay,
  validateOverlayAgainstCatalog,
  writeOverlay,
  type Overlay,
} from './overlay.ts'
import { resolveDshHome } from './home.ts'
import { readPotetoDefault, writePotetoDefault } from './poteto-default.ts'
import { dropUnselectableRoles } from './settings-draft.ts'

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
  potetoDefault: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The role overlay a save body names, accepting the old bare-overlay body too. */
function overlayOf(raw: unknown): unknown {
  return isRecord(raw) && 'overlay' in raw ? raw.overlay : raw
}

/** The requested default, or undefined when the body keeps the saved one. */
function defaultOf(raw: unknown): boolean | undefined {
  if (!isRecord(raw) || !('potetoDefault' in raw)) return undefined
  const value = raw.potetoDefault
  if (typeof value !== 'boolean') throw new Error('potetoDefault must be a boolean')
  return value
}

export async function loadSettingsSnapshot(host: CatalogHost): Promise<SettingsSnapshot> {
  const dshHome = host.dshHome ?? resolveDshHome(host.env)
  const catalog = await buildCatalog({ ...host, dshHome })
  const current = await readOverlay(dshHome)
  const { overlay, droppedRoles } = dropUnselectableRoles(current.overlay, catalog.routes)
  return {
    catalog,
    overlay,
    path: current.path,
    missing: current.missing,
    droppedRoles,
    potetoDefault: readPotetoDefault(dshHome),
  }
}

export async function saveSettingsOverlay(host: CatalogHost, raw: unknown): Promise<SettingsSaveResult> {
  const dshHome = host.dshHome ?? resolveDshHome(host.env)
  const overlayRaw = overlayOf(raw)
  if (overlayRaw === undefined) throw new Error('overlay is required')
  const overlay = typeof overlayRaw === 'string' ? parseOverlay(overlayRaw) : parseOverlay(JSON.stringify(overlayRaw))
  const requestedDefault = defaultOf(raw)
  const catalog = await buildCatalog({ ...host, dshHome })
  const errors = validateOverlayAgainstCatalog(overlay, catalog.routes)
  if (errors.length > 0) {
    const error = new Error(`overlay rejected against live catalog:\n${errors.join('\n')}`)
    ;(error as Error & { errors: string[] }).errors = errors
    throw error
  }
  const path = await writeOverlay(overlay, dshHome)
  if (requestedDefault === undefined) {
    return { path, overlay, potetoDefault: readPotetoDefault(dshHome) }
  }
  await writePotetoDefault(requestedDefault, dshHome)
  return { path, overlay, potetoDefault: requestedDefault }
}
