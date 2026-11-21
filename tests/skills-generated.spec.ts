import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { buildSkills, DEST, SOURCE } from '../scripts/sync-skills.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

async function walk(dir: string): Promise<string[]> {
  const out = []
  for (const name of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, name.name)
    if (name.isDirectory()) out.push(...await walk(full))
    else if (name.name.endsWith('.md')) out.push(full)
  }
  return out
}

describe('generated skills', () => {
  it('rewrites every upstream file without leaving a Cursor name', () => {
    const { skills, failures } = buildSkills()
    assert.deepEqual(failures, [])
    assert.ok(skills.size > 100)
  })

  it('matches what is committed, so the tree cannot drift', async () => {
    const { skills } = buildSkills()
    const onDisk = new Set((await walk(join(ROOT, DEST))).map(file => relative(join(ROOT, DEST), file).replaceAll('\\', '/')))
    // Port-owned files are not generated; everything else must match byte for byte.
    const owned = new Set(['setup-pstack/SKILL.md', 'setup-pstack/references/spawn.md', 'setup-pstack/references/catalog.md'])
    for (const [target, text] of skills as Map<string, string>) {
      assert.ok(onDisk.has(target), `${target} is missing from skills/`)
      assert.equal(await readFile(join(ROOT, DEST, target), 'utf8'), text, `${target} differs from its generated form`)
    }
    for (const target of onDisk) {
      assert.ok(skills.has(target) || owned.has(target), `${target} is not generated and not port-owned`)
    }
  })

  it('keeps the upstream snapshot for the generator', async () => {
    const files = await walk(join(ROOT, SOURCE))
    assert.ok(files.length > 100)
  })
})
