import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

test('generator creates a fresh tree, detects drift without writes, and preserves siblings', () => {
  const root = mkdtempSync(join(tmpdir(), 'pstack-generator-'))
  try {
    for (const path of ['scripts', 'harness/pstack/dsh/adaptations', 'pstack', 'upstream.lock.json', 'LICENSE']) cpSync(resolve(path), join(root, path), { recursive: true })
    const run = (...args: string[]) => spawnSync(process.execPath, ['scripts/generate-pstack-harness-trees.mjs', ...args], { cwd: root, encoding: 'utf8' })
    mkdirSync(join(root, 'harness/pstack/other'), { recursive: true })
    writeFileSync(join(root, 'harness/pstack/other/keep'), 'sibling')
    mkdirSync(join(root, 'harness/pstack/dsh/src'), { recursive: true })
    writeFileSync(join(root, 'harness/pstack/dsh/src/keep'), 'authored')
    assert.equal(run().status, 0)
    const skill = join(root, 'harness/pstack/dsh/generated/skills/poteto-mode/SKILL.md')
    assert.ok(existsSync(skill))
    const original = readFileSync(skill)
    writeFileSync(skill, 'drift')
    const stale = join(root, 'harness/pstack/dsh/generated/stale')
    writeFileSync(stale, 'stale')
    assert.notEqual(run('--check').status, 0)
    assert.equal(readFileSync(skill, 'utf8'), 'drift')
    assert.equal(readFileSync(stale, 'utf8'), 'stale')
    assert.equal(run().status, 0)
    assert.deepEqual(readFileSync(skill), original)
    assert.equal(existsSync(stale), false)
    assert.equal(readFileSync(join(root, 'harness/pstack/other/keep'), 'utf8'), 'sibling')
    assert.equal(readFileSync(join(root, 'harness/pstack/dsh/src/keep'), 'utf8'), 'authored')
    assert.equal(run('--check').status, 0)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
