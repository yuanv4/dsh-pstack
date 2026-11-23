import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve, relative, sep } from 'node:path'

const headers = { 'user-agent': 'pstack-dsh-sync' }
const extraFiles = ['pstack/README.md', 'pstack/LICENSE', 'pstack/plugin.json']
const extraTrees = ['pstack/docs/harness']
const trees = [
  { upstream: 'pstack/skills', snapshot: 'pstack/skills', dest: 'skills', mode: 'rewrite' },
  { upstream: 'pstack/agents', snapshot: 'pstack/agents', dest: 'agents', mode: 'rewrite' },
  { upstream: 'pstack/docs/guide', snapshot: 'pstack/docs/guide', dest: 'docs/guide', mode: 'verbatim' },
]
function validateLock(lock, inventory = true) {
  if (lock.repository !== 'cursor/plugins' || !/^[0-9a-f]{40}$/.test(lock.commit) ||
      lock.normalization !== 'utf8-crlf-to-lf-trailing-newlines-to-one-for-md-txt-json' ||
      JSON.stringify(lock.trees) !== JSON.stringify(trees)) throw new Error('Invalid upstream lock configuration')
  if (!inventory) return
  if (!Array.isArray(lock.files) || !lock.files.length) throw new Error('Missing upstream inventory')
  const names = new Set()
  for (const file of lock.files) {
    if (typeof file.path !== 'string' || !selected(lock, file.path) || !/^[0-9a-f]{40}$/.test(file.gitBlob) || !/^[0-9a-f]{64}$/.test(file.sha256) || names.has(file.path)) throw new Error('Invalid upstream inventory')
    safeFile(process.cwd(), file.path)
    names.add(file.path)
  }
}
const hash = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex')
const gitBlob = bytes => hash('sha1', Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes]))
const normalize = (path, bytes) => /\.(md|txt|json)$/.test(path)
  ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '\n')) : bytes
const selected = (lock, path) => lock.trees.some(tree => path.startsWith(`${tree.upstream}/`)) || extraTrees.some(tree => path.startsWith(`${tree}/`)) || extraFiles.includes(path)

function safeFile(root, path) {
  if (typeof path !== 'string' || path.startsWith('/') || path.includes('\\') || path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error(`Unsafe path: ${path}`)
  if (!path.startsWith('pstack/')) throw new Error(`Path outside snapshot: ${path}`)
  const base = resolve(root, 'pstack')
  const file = resolve(root, path)
  if (!file.startsWith(base + sep)) throw new Error(`Path outside snapshot: ${path}`)
  let current = resolve(root)
  for (const part of relative(current, file).split(sep)) {
    current = resolve(current, part)
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error(`Symlink in snapshot path: ${current}`)
  }
  return file
}

function walk(dir, root) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(dir, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Symlink in snapshot: ${path}`)
    if (entry.isDirectory()) return walk(path, root)
    if (!entry.isFile()) throw new Error(`Unsupported snapshot entry: ${path}`)
    return [relative(root, path).split(sep).join('/')]
  })
}

export function verifySnapshot({ lock, root = process.cwd() }) {
  validateLock(lock)
  const base = resolve(root, 'pstack')
  if (lstatSync(base).isSymbolicLink()) throw new Error(`Symlink in snapshot: ${base}`)
  const expected = lock.files.map(file => file.path).sort()
  const actual = walk(base, root).sort()
  if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Snapshot inventory differs from lock')
  for (const file of lock.files) {
    if (hash('sha256', readFileSync(safeFile(root, file.path))) !== file.sha256) throw new Error(`Snapshot hash mismatch: ${file.path}`)
  }
}

export async function downloadSnapshot({ lock, fetchImpl = fetch, updateLock = false }) {
  validateLock(lock, !updateLock)
  const response = await fetchImpl(`https://api.github.com/repos/${lock.repository}/git/trees/${lock.commit}?recursive=1`, { headers: { ...headers, accept: 'application/vnd.github+json' } })
  if (!response.ok) throw new Error(`Tree request failed: ${response.status}`)
  const tree = await response.json()
  if (tree.truncated !== false || !Array.isArray(tree.tree)) throw new Error('Incomplete upstream tree')
  const entries = tree.tree.filter(entry => entry.type === 'blob' && selected(lock, entry.path)).sort((a, b) => a.path.localeCompare(b.path))
  if (!entries.length || new Set(entries.map(entry => entry.path)).size !== entries.length) throw new Error('Empty or duplicate upstream inventory')
  for (const entry of entries) {
    safeFile(process.cwd(), entry.path)
    if (!['100644', '100755'].includes(entry.mode) || !/^[0-9a-f]{40}$/.test(entry.sha)) throw new Error(`Invalid git blob: ${entry.path}`)
  }
  if (!updateLock) {
    const expected = lock.files.map(({ path, gitBlob }) => `${path} ${gitBlob}`).sort()
    const actual = entries.map(entry => `${entry.path} ${entry.sha}`).sort()
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error('Upstream tree differs from lock')
  }
  const results = new Array(entries.length)
  let next = 0
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (next < entries.length) {
      const index = next++
      const entry = entries[index]
      const result = await fetchImpl(`https://raw.githubusercontent.com/${lock.repository}/${lock.commit}/${entry.path}`, { headers })
      if (!result.ok) throw new Error(`Blob request failed: ${entry.path} ${result.status}`)
      const bytes = Buffer.from(await result.arrayBuffer())
      if (gitBlob(bytes) !== entry.sha) throw new Error(`Git blob mismatch: ${entry.path}`)
      const normalized = normalize(entry.path, bytes)
      const sha256 = hash('sha256', normalized)
      const expected = updateLock ? undefined : lock.files.find(file => file.path === entry.path)
      if (expected && expected.sha256 !== sha256) throw new Error(`Normalized hash mismatch: ${entry.path}`)
      results[index] = { path: entry.path, gitBlob: entry.sha, sha256, bytes: normalized }
    }
  }))
  return results
}

export async function fetchSnapshot({ lock, root = process.cwd(), fetchImpl = fetch }) {
  const files = await downloadSnapshot({ lock, fetchImpl })
  const targets = [...lock.trees.map(tree => tree.upstream), ...extraTrees, ...extraFiles].map(path => safeFile(root, path))
  const writes = files.map(file => {
    if (!selected(lock, file.path)) throw new Error(`File outside selected trees: ${file.path}`)
    return { ...file, target: safeFile(root, file.path) }
  })
  for (const target of targets) rmSync(target, { recursive: true, force: true })
  for (const file of writes) {
    const target = file.target
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, file.bytes)
  }
  verifySnapshot({ lock, root })
}
