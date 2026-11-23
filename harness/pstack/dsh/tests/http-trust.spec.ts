import assert from 'node:assert/strict'
import type { IncomingMessage } from 'node:http'
import { it } from 'node:test'
import { trustedRequest } from '../src/http-trust.ts'

function request(headers: Record<string, string>, remoteAddress = '100.85.113.37'): IncomingMessage {
  return { socket: { remoteAddress }, headers } as unknown as IncomingMessage
}

it('accepts a same-origin request from a trusted non-loopback address', () => {
  assert.equal(trustedRequest(request({ host: '100.85.113.37:3080', origin: 'http://100.85.113.37:3080' })), true)
})

it('rejects cross-site and mismatched origins', () => {
  assert.equal(trustedRequest(request({ host: '100.85.113.37:3080', origin: 'http://100.85.113.37:3080', 'sec-fetch-site': 'cross-site' })), false)
  assert.equal(trustedRequest(request({ host: '100.85.113.37:3080', origin: 'http://127.0.0.1:3080' })), false)
  assert.equal(trustedRequest(request({ host: '100.85.113.37:3080', origin: ':::' })), false)
})

it('requires a host and accepts a request without an origin', () => {
  assert.equal(trustedRequest(request({ origin: 'http://100.85.113.37:3080' })), false)
  assert.equal(trustedRequest(request({ host: '100.85.113.37:3080' })), true)
})
