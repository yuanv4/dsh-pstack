import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildSkills, TREES } from '../scripts/sync-skills.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walk(full))
    else out.push(full)
  }
  return out
}

const OWNED = new Set([
  'skills/setup-pstack/SKILL.md',
  'skills/setup-pstack/references/spawn.md',
  'skills/setup-pstack/references/catalog.md',
])

describe('generated trees', () => {
  it('rewrites every mirrored file without leaving a Cursor name', () => {
    const { files, failures } = buildSkills()
    assert.deepEqual(failures, [])
    assert.ok(files.size > 200)
  })

  it('matches what is committed, so a tree cannot drift', async () => {
    const { files } = buildSkills()
    for (const [target, value] of files) {
      if (typeof value === 'string') {
        assert.equal(await readFile(join(ROOT, target), 'utf8'), value, `${target} differs from its generated form`)
      } else {
        const committed = await readFile(join(ROOT, target))
        const source = await readFile(join(ROOT, value.copyFrom))
        assert.deepEqual(committed, source, `${target} differs from its snapshot`)
      }
    }
  })

  it('keeps no hand-written file that the generator does not own', async () => {
    const { files } = buildSkills()
    const generated = new Set(files.keys())
    for (const { dest } of TREES) {
      for (const file of await walk(join(ROOT, dest))) {
        const target = relative(join(ROOT), file).replaceAll('\\', '/')
        assert.ok(generated.has(target) || OWNED.has(target), `${target} is neither generated nor port-owned`)
      }
    }
  })

  it('keeps the upstream snapshot for the generator', async () => {
    for (const { source } of TREES) {
      assert.ok((await walk(join(ROOT, source))).length > 0, source)
    }
  })
})
