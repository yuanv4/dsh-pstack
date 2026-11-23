import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { downloadSnapshot, fetchSnapshot, verifySnapshot } from './upstream-source.mjs'

const lock = JSON.parse(readFileSync(new URL('../upstream.lock.json', import.meta.url), 'utf8'))

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === '--verify') {
    verifySnapshot({ lock })
    console.log(`Verified ${lock.files.length} snapshot files against upstream.lock.json`)
  } else if (process.argv[2] === '--update-lock') {
    const files = await downloadSnapshot({ lock, updateLock: true })
    lock.files = files.map(({ path, gitBlob, sha256 }) => ({ path, gitBlob, sha256 }))
    writeFileSync(new URL('../upstream.lock.json', import.meta.url), `${JSON.stringify(lock, null, 2)}\n`)
    console.log(`Updated lock from ${files.length} verified upstream blobs`)
  } else if (process.argv.length === 2) {
    await fetchSnapshot({ lock })
    console.log(`Fetched and verified ${lock.files.length} files from ${lock.repository}@${lock.commit}`)
  } else {
    throw new Error('Usage: node scripts/fetch-upstream.mjs [--verify|--update-lock]')
  }
}
