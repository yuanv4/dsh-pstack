import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
// @ts-expect-error The executable JavaScript module has no TypeScript declaration.
import { downloadSnapshot, fetchSnapshot, verifySnapshot } from '../../../../scripts/upstream-source.mjs'

const blob = Buffer.from('hello\r\n\r\n')
const gitHash = createHash('sha1').update(`blob ${blob.length}\0`).update(blob).digest('hex')
const lock = {
  repository: 'cursor/plugins', commit: '792440e8a560a4a3f63748cdee70491ecd412982',
  normalization: 'utf8-crlf-to-lf-trailing-newlines-to-one-for-md-txt-json',
  trees: [
    { upstream: 'pstack/skills', snapshot: 'pstack/skills', dest: 'skills', mode: 'rewrite' },
    { upstream: 'pstack/agents', snapshot: 'pstack/agents', dest: 'agents', mode: 'rewrite' },
    { upstream: 'pstack/docs/guide', snapshot: 'pstack/docs/guide', dest: 'docs/guide', mode: 'verbatim' },
  ],
  files: [{ path: 'pstack/skills/a.md', gitBlob: gitHash, sha256: createHash('sha256').update('hello\n').digest('hex') }],
}
const tree = { truncated: false, tree: [{ path: 'pstack/skills/a.md', type: 'blob', mode: '100644', sha: gitHash }] }
function fakeFetch(failure: 'none' | 'tree' | 'truncated' | 'blob' | 'corrupt' | 'symlink' = 'none') {
  return async (url: string) => {
    if (url.includes('/git/trees/')) return new Response(JSON.stringify(failure === 'truncated' ? { ...tree, truncated: true } : failure === 'symlink' ? { ...tree, tree: [{ ...tree.tree[0], mode: '120000' }] } : tree), { status: failure === 'tree' ? 500 : 200 })
    return new Response(failure === 'corrupt' ? 'bad bytes' : blob, { status: failure === 'blob' ? 500 : 200 })
  }
}
function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'pstack-source-'))
  mkdirSync(join(root, 'pstack/skills'), { recursive: true })
  writeFileSync(join(root, 'pstack/skills/old.md'), 'accepted')
  return root
}

test('failed or truncated downloads leave the accepted snapshot untouched', async () => {
  for (const failure of ['tree', 'truncated', 'blob', 'corrupt', 'symlink'] as const) {
    const root = workspace()
    try {
      await assert.rejects(fetchSnapshot({ lock, root, fetchImpl: fakeFetch(failure) }))
      assert.equal(readFileSync(join(root, 'pstack/skills/old.md'), 'utf8'), 'accepted')
    } finally { rmSync(root, { recursive: true, force: true }) }
  }
})

test('successful download normalizes, removes stale files, and verifies exact inventory', async () => {
  const root = workspace()
  try {
    writeFileSync(join(root, 'outside.txt'), 'preserve')
    await fetchSnapshot({ lock, root, fetchImpl: fakeFetch() })
    assert.equal(readFileSync(join(root, 'outside.txt'), 'utf8'), 'preserve')
    verifySnapshot({ lock, root })
    const file = join(root, 'pstack/skills/a.md')
    assert.equal(readFileSync(file, 'utf8'), 'hello\n')
    writeFileSync(file, 'changed')
    assert.throws(() => verifySnapshot({ lock, root }))
    writeFileSync(file, 'hello\n')
    writeFileSync(join(root, 'pstack/skills/extra.md'), 'extra')
    assert.throws(() => verifySnapshot({ lock, root }))
    rmSync(join(root, 'pstack/skills/extra.md'))
    rmSync(file)
    assert.throws(() => verifySnapshot({ lock, root }))
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('invalid lock data cannot delete the accepted snapshot', async () => {
  for (const invalid of [
    { ...lock, repository: 'other/repo' },
    { ...lock, normalization: 'unknown' },
    { ...lock, trees: [{ ...lock.trees[0], upstream: 'pstack/other' }] },
    { ...lock, files: [{ ...lock.files[0], path: 'pstack/skills/../other' }] },
    { ...lock, files: [{ ...lock.files[0], path: 'pstack-other/skills/a.md' }] },
    { ...lock, files: [{ ...lock.files[0], path: '/pstack/skills/a.md' }] },
    { ...lock, files: [{ ...lock.files[0], path: 'pstack/skills/a.md' }, lock.files[0]] },
  ]) {
    const root = workspace()
    try {
      await assert.rejects(fetchSnapshot({ lock: invalid, root, fetchImpl: fakeFetch() }))
      assert.equal(readFileSync(join(root, 'pstack/skills/old.md'), 'utf8'), 'accepted')
    } finally { rmSync(root, { recursive: true, force: true }) }
  }
})

test('snapshot traversal rejects directory links and preserves their targets', async (t) => {
  const root = workspace()
  try {
    const outside = join(root, 'outside')
    mkdirSync(outside)
    writeFileSync(join(outside, 'keep'), 'untouched')
    rmSync(join(root, 'pstack/skills'), { recursive: true })
    try { symlinkSync(outside, join(root, 'pstack/skills'), process.platform === 'win32' ? 'junction' : 'dir') }
    catch (error) {
      if (process.platform === 'win32' && (error as NodeJS.ErrnoException).code === 'EPERM') { t.skip('symlink privilege unavailable'); return }
      throw error
    }
    assert.throws(() => verifySnapshot({ lock, root }))
    await assert.rejects(fetchSnapshot({ lock, root, fetchImpl: fakeFetch() }))
    assert.equal(readFileSync(join(outside, 'keep'), 'utf8'), 'untouched')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('a changed upstream inventory requires an explicit lock update', async () => {
  const changedTree = { ...tree, tree: [...tree.tree, { ...tree.tree[0], path: 'pstack/skills/b.md' }] }
  const fetchImpl = async (url: string) => url.includes('/git/trees/')
    ? new Response(JSON.stringify(changedTree)) : new Response(blob)
  const root = workspace()
  try {
    await assert.rejects(fetchSnapshot({ lock, root, fetchImpl }), /Upstream tree differs from lock/)
    assert.equal(readFileSync(join(root, 'pstack/skills/old.md'), 'utf8'), 'accepted')
    const updated = await downloadSnapshot({ lock, fetchImpl, updateLock: true })
    assert.deepEqual(updated.map(({ path, gitBlob, sha256 }: { path: string; gitBlob: string; sha256: string }) => ({ path, gitBlob, sha256 })), [
      lock.files[0], { ...lock.files[0], path: 'pstack/skills/b.md' },
    ])
    assert.equal(readFileSync(join(root, 'pstack/skills/old.md'), 'utf8'), 'accepted')
    assert.equal(lock.files.length, 1)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('committed lock identifies the sole upstream and verifies the committed snapshot', () => {
  const committed = JSON.parse(readFileSync('upstream.lock.json', 'utf8'))
  assert.equal(committed.repository, 'cursor/plugins')
  assert.equal(committed.commit, '792440e8a560a4a3f63748cdee70491ecd412982')
  assert.deepEqual(committed.trees, lock.trees)
  verifySnapshot({ lock: committed, root: process.cwd() })
})

test('repository and installation point at the project without renaming the package', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  assert.equal(pkg.name, 'pstack-dsh')
  assert.match(readFileSync('cordis.patch.yml', 'utf8'), /id: pstack-dsh/)
  assert.match(readFileSync('cordis.patch.yml', 'utf8'), /name: pstack-dsh/)
  assert.equal(pkg.repository.url, 'git+https://github.com/yuanv4/dsh-pstack.git')
  assert.equal(pkg.homepage, 'https://github.com/yuanv4/dsh-pstack')
})
