/**
 * Whether a newly created session starts with the poteto workflow already on.
 *
 * The per-session switch stays in `pstack-poteto.json`; this one global flag
 * only decides what a brand-new session starts with, so turning it on or off
 * never changes a session that is already open. The file matches the shape an
 * earlier pstack port wrote, so an existing `pstack-settings.json` still reads.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { resolveDshHome } from './home.ts'

export const DEFAULT_SETTINGS_FILENAME = 'pstack-settings.json'
export const DEFAULT_SETTINGS_VERSION = 1 as const

export interface PotetoDefaultFile {
  readonly version: typeof DEFAULT_SETTINGS_VERSION
  readonly potetoDefault: boolean
}

export function defaultPath(dshHome = resolveDshHome()): string {
  return join(dshHome, DEFAULT_SETTINGS_FILENAME)
}

/** The saved default. A missing, malformed, or future-version file means off. */
export function readPotetoDefault(dshHome = resolveDshHome()): boolean {
  try {
    const parsed = JSON.parse(readFileSync(defaultPath(dshHome), 'utf8')) as Partial<PotetoDefaultFile>
    return parsed.version === DEFAULT_SETTINGS_VERSION && parsed.potetoDefault === true
  } catch {
    return false
  }
}

/** Persist the default for sessions created later. */
export async function writePotetoDefault(potetoDefault: boolean, dshHome = resolveDshHome()): Promise<void> {
  const body: PotetoDefaultFile = { version: DEFAULT_SETTINGS_VERSION, potetoDefault }
  await writeFileAtomic(defaultPath(dshHome), `${JSON.stringify(body, null, 2)}\n`, { mode: 0o600, dirMode: 0o700 })
}
