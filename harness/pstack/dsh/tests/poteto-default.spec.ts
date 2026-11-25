import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import {
  DEFAULT_SETTINGS_FILENAME,
  DEFAULT_SETTINGS_VERSION,
  defaultPath,
  readPotetoDefault,
  writePotetoDefault,
} from '../src/poteto-default.ts'

describe('poteto default setting', () => {
  let home: string

  before(async () => {
    home = await mkdtemp(join(tmpdir(), 'pstack-poteto-default-'))
  })

  after(async () => {
    await rm(home, { recursive: true, force: true })
  })

  it('reads off when the file does not exist', () => {
    assert.equal(readPotetoDefault(home), false)
  })

  it('writes and reads the legacy-compatible shape', async () => {
    await writePotetoDefault(true, home)
    assert.equal(defaultPath(home).endsWith(DEFAULT_SETTINGS_FILENAME), true)
    assert.match(defaultPath(home), /pstack-settings\.json$/)
    assert.equal(readPotetoDefault(home), true)
    const { readFile } = await import('node:fs/promises')
    const stored = JSON.parse(await readFile(defaultPath(home), 'utf8')) as Record<string, unknown>
    assert.deepEqual(stored, { version: DEFAULT_SETTINGS_VERSION, potetoDefault: true })
    await writePotetoDefault(false, home)
    assert.equal(readPotetoDefault(home), false)
  })

  it('reads off for malformed, unsupported, or non-boolean files', async () => {
    for (const body of ['{not json', '{"version":2,"potetoDefault":true}', '{"version":1,"potetoDefault":"yes"}', '[]']) {
      await writeFile(defaultPath(home), body)
      assert.equal(readPotetoDefault(home), false, body)
    }
  })
})
