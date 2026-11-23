import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, posix, relative, resolve, sep } from 'node:path'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { rewrite } from '../harness/pstack/dsh/adaptations/rewrites.mjs'

const lock = JSON.parse(readFileSync(new URL('../upstream.lock.json', import.meta.url), 'utf8'))
export const TREES = lock.trees.map(({ snapshot, dest, mode }) => ({ source: snapshot, dest: `harness/pstack/dsh/generated/${dest}`, mode }))
const OUT = 'harness/pstack/dsh/generated'

const LOCAL_SETUP_OVERRIDES = new Set([
  'setup-pstack/SKILL.md',
  'setup-pstack/references/spawn.md',
  'setup-pstack/references/catalog.md',
])

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = lstatSync(full)
    if (stat.isSymbolicLink()) throw new Error(`Unexpected symlink: ${full}`)
    if (stat.isDirectory()) out.push(...walk(full))
    else if (stat.isFile()) out.push(full)
    else throw new Error(`Unsupported entry: ${full}`)
  }
  return out
}

export function validateLinks(files) {
  const failures = []
  for (const [path, value] of files) {
    if (!path.endsWith('.md')) continue
    const text = typeof value === 'string' ? value : readFileSync(value.copyFrom, 'utf8')
    const prose = text.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1\s*$/gm, '').replace(/`+[^`\n]*`+/g, '')
    for (const [, href] of prose.matchAll(/\]\(<?([^\s)>]+)>?(?:\s+["'][^\n]*?["'])?\)/g)) {
      const target = href.split(/[?#]/, 1)[0]
      if (!target || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue
      const resolved = posix.normalize(posix.join(posix.dirname(path), target))
      if (!files.has(resolved) && ![...files.keys()].some(key => key.startsWith(`${resolved.replace(/\/$/, '')}/`))) {
        failures.push(`${path} links to missing ${href}`)
      }
    }
  }
  return failures
}

/**
 * Build every generated tree in memory: output path to either file text, or
 * `{ copyFrom }` for a binary or non-Markdown asset copied byte for byte.
 */
export function buildSkills() {
  const files = new Map()
  const failures = []
  for (const { source, dest, mode } of TREES) {
    for (const file of walk(source)) {
      const rel = relative(source, file).replaceAll('\\', '/')
      if (!file.endsWith('.md')) {
        files.set(`${dest}/${rel}`, { copyFrom: file })
        continue
      }
      if (mode === 'rewrite' && LOCAL_SETUP_OVERRIDES.has(rel)) continue
      let text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '\n')
      if (mode === 'rewrite') {
        text = rewrite(text, rel, dest, failures)
      }
      if (dest.endsWith('/docs/guide') && rel === '07-overnight.md') {
        for (const name of ['README.md', 'FOR_AGENTS.md']) {
          text = text.replace(`](../../automations/benny/${name})`, `](https://github.com/cursor/plugins/blob/${lock.commit}/pstack/automations/benny/${name})`)
        }
      }
      files.set(`${dest}/${rel}`, text)
    }
  }
  for (const rel of LOCAL_SETUP_OVERRIDES) {
    files.set(`${OUT}/skills/${rel}`, { copyFrom: `harness/pstack/dsh/adaptations/skills/${rel}` })
  }
  files.set(`${OUT}/docs/harness/claude-code.md`, { copyFrom: 'pstack/docs/harness/claude-code.md' })
  files.set(`${OUT}/docs/harness/dsh.md`, { copyFrom: 'harness/pstack/dsh/adaptations/dsh.md' })
  files.set(`${OUT}/HARNESS.md`, { copyFrom: 'harness/pstack/dsh/adaptations/dsh.md' })
  files.set(`${OUT}/LICENSE`, { copyFrom: 'LICENSE' })
  files.set(`${OUT}/README.md`, '# pstack for DSH\n\nThis generated tree contains the DSH skills, agents, guide, and [platform map](docs/harness/dsh.md). Run `node scripts/generate-pstack-harness-trees.mjs` from the repository root to regenerate it.\n')
  failures.push(...validateLinks(files))
  return { files, failures }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { files, failures } = buildSkills()
  if (failures.length > 0) {
    console.error(`${failures.length} generated-tree validation failures:`)
    for (const row of failures) console.error('  ' + row)
    process.exit(1)
  }
  const base = resolve(OUT)
  let current = resolve('.')
  for (const part of relative(current, base).split(sep)) {
    current = resolve(current, part)
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`Symlink in output path: ${current}`)
  }
  const existing = existsSync(base) ? walk(base) : []
  const keep = new Set(files.keys())
  const stale = existing.filter(file => !keep.has(relative('.', file).replaceAll('\\', '/')))
  const differs = [...files].filter(([target, value]) => !existsSync(target) || !readFileSync(target).equals(typeof value === 'string' ? Buffer.from(value) : readFileSync(value.copyFrom)) || (process.platform !== 'win32' && Boolean(statSync(target).mode & 0o111) !== (typeof value !== 'string' && Boolean(statSync(value.copyFrom).mode & 0o111))))
  if (process.argv.includes('--check')) {
    if (stale.length || differs.length) throw new Error(`Generated tree drift: ${[...stale, ...differs.map(([path]) => path)].join(', ')}`)
    console.log('Generated DSH tree is up to date')
    process.exit(0)
  }
  for (const file of stale) {
    const absolute = resolve(file)
    if (!absolute.startsWith(base + sep)) throw new Error(`Refusing to delete outside ${base}: ${absolute}`)
    unlinkSync(absolute)
  }
  const pruned = stale.length
  let copied = 0
  for (const [target, value] of files) {
    mkdirSync(dirname(target), { recursive: true })
    if (typeof value === 'string') writeFileSync(target, value)
    else {
      copyFileSync(value.copyFrom, target)
      copied += 1
    }
    if (process.platform !== 'win32') chmodSync(target, typeof value !== 'string' && (statSync(value.copyFrom).mode & 0o111) ? 0o755 : 0o644)
  }
  console.log(`generated ${files.size - copied} text files and ${copied} copied assets, pruned ${pruned} stale files`)
}
