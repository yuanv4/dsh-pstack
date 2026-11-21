/**
 * Snapshot `cursor/plugins` `pstack/skills` at the pinned commit into `upstream/`.
 * The generator reads that snapshot, so syncing needs no network after this runs.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const UPSTREAM_SHA = '792440e8a560a4a3f63748cdee70491ecd412982'
const DEST = 'upstream/pstack/skills'

const treeResponse = await fetch(`https://api.github.com/repos/cursor/plugins/git/trees/${UPSTREAM_SHA}?recursive=1`, {
  headers: { accept: 'application/vnd.github+json', 'user-agent': 'pstack-dsh-sync' },
})
if (!treeResponse.ok) {
  console.error('tree request failed', treeResponse.status)
  process.exit(1)
}
const entries = (await treeResponse.json()).tree
  .filter(item => item.type === 'blob' && item.path.startsWith('pstack/skills/') && item.path.endsWith('.md'))
  .map(item => ({ rawPath: item.path, target: item.path.slice('pstack/skills/'.length) }))

let count = 0
for (const { rawPath, target } of entries) {
  const response = await fetch(`https://raw.githubusercontent.com/cursor/plugins/${UPSTREAM_SHA}/${rawPath}`, {
    headers: { 'user-agent': 'pstack-dsh-sync' },
  })
  if (!response.ok) {
    console.error('failed', rawPath, response.status)
    continue
  }
  const text = (await response.text()).replace(/\r\n/g, '\n').replace(/\n+$/, '\n')
  const file = join(DEST, target)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
  count += 1
}
console.log(`snapshot: ${count} files from cursor/plugins@${UPSTREAM_SHA} into ${DEST}`)
