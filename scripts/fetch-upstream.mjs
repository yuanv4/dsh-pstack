/**
 * Snapshot the upstream trees this port mirrors into `upstream/`.
 *
 * Text lives in `upstream/<tree>/`; the generator rewrites and copies it. Images
 * are copied byte for byte, since nothing about them is harness-specific.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const UPSTREAM_SHA = '792440e8a560a4a3f63748cdee70491ecd412982'
const TREES = ['pstack/skills', 'pstack/agents', 'pstack/docs/guide']
const TEXT = /\.(md|txt|json)$/

const headers = { 'user-agent': 'pstack-dsh-sync' }
const treeResponse = await fetch(`https://api.github.com/repos/cursor/plugins/git/trees/${UPSTREAM_SHA}?recursive=1`, {
  headers: { ...headers, accept: 'application/vnd.github+json' },
})
if (!treeResponse.ok) {
  console.error('tree request failed', treeResponse.status)
  process.exit(1)
}
const blobs = (await treeResponse.json()).tree
  .filter(item => item.type === 'blob' && TREES.some(tree => item.path.startsWith(`${tree}/`)))

let text = 0
let binary = 0
for (const { path } of blobs) {
  const response = await fetch(`https://raw.githubusercontent.com/cursor/plugins/${UPSTREAM_SHA}/${path}`, { headers })
  if (!response.ok) {
    console.error('failed', path, response.status)
    continue
  }
  const file = join('upstream', path)
  mkdirSync(dirname(file), { recursive: true })
  if (TEXT.test(path)) {
    const body = (await response.text()).replace(/\r\n/g, '\n').replace(/\n+$/, '\n')
    writeFileSync(file, body)
    text += 1
  } else {
    writeFileSync(file, Buffer.from(await response.arrayBuffer()))
    binary += 1
  }
}
console.log(`snapshot: ${text} text files, ${binary} binary files from cursor/plugins@${UPSTREAM_SHA}`)
