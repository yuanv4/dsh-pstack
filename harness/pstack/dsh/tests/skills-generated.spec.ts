import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import * as generator from '../../../../scripts/generate-pstack-harness-trees.mjs'
import { buildSkills, TREES } from '../../../../scripts/generate-pstack-harness-trees.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walk(full))
    else out.push(full)
  }
  return out
}

describe('generated trees', () => {
  it('rewrites every mirrored file without leaving a Cursor name', () => {
    const { files, failures } = buildSkills()
    assert.deepEqual(failures, [])
    assert.ok(files.size > 200)
  })

  it('checks relative links while ignoring anchors and code examples', () => {
    const validateLinks = Reflect.get(generator, 'validateLinks')
    const files = new Map([
      ['tree/guide.md', '[valid](./target.md#part) [anchor](#part)\n`[example](./absent.md)`\n```md\n[example](./absent.md)\n```\n'],
      ['tree/target.md', '# target\n'],
    ])
    assert.deepEqual(validateLinks(files), [])
    files.set('tree/guide.md', '[broken](./missing.md)')
    assert.match(validateLinks(files).join('\n'), /tree\/guide\.md.*missing\.md/)
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

  it('copies the locally authored setup files to their public paths', async () => {
    const { files } = buildSkills()
    for (const rel of ['SKILL.md', 'references/spawn.md', 'references/catalog.md']) {
      const target = `harness/pstack/dsh/generated/skills/setup-pstack/${rel}`
      assert.ok(files.has(target), `${target} is absent from the output inventory`)
      assert.deepEqual(
        await readFile(join(ROOT, target)),
        await readFile(join(ROOT, 'harness/pstack/dsh/adaptations/skills/setup-pstack', rel)),
        `${target} differs from its local source`,
      )
    }
  })

  it('keeps no file that the generator does not own', async () => {
    const { files } = buildSkills()
    const generated = new Set(files.keys())
    for (const file of await walk(join(ROOT, 'harness/pstack/dsh/generated'))) {
      const target = relative(ROOT, file).replaceAll('\\', '/')
      assert.ok(generated.has(target), `${target} is not generated`)
    }
  })

  it('keeps the upstream snapshot for the generator', async () => {
    for (const { source } of TREES) {
      assert.ok((await walk(join(ROOT, source))).length > 0, source)
    }
  })
})
