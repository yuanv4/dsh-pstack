import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { registerHooks } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

if (!process.env.DSH_INSTALL_DIR) throw new Error('Run from DSH or set DSH_INSTALL_DIR')
const anchor = pathToFileURL(join(process.env.DSH_INSTALL_DIR, 'package.json')).href
registerHooks({
  resolve(specifier, context, next) {
    return next(specifier, specifier.startsWith('@deepseek-ai/') ? { ...context, parentURL: anchor } : context)
  },
})
const target = process.argv[2] ? pathToFileURL(process.argv[2]) : new URL('./src/index.ts', import.meta.url)
const { apply } = await import(target.href)
const tools = new Map()
const model = 'gpt-6.1-sol'
let signedIn = true
const llm = {
  listProviders: () => [{ id: 'codex', name: 'ChatGPT' }, { id: 'private-proxy', name: 'Private Proxy' }],
  listModels: async id => id === 'codex' && !signedIn ? [] : [{ id: model, name: 'Sol' }],
  resolveModelInfo: async () => ({ id: model, name: 'Sol', reasoning: { efforts: [{ id: 'high', name: 'High' }] } }),
}
const home = await mkdtemp(join(tmpdir(), 'pstack-codex-test-'))
const previousHome = process.env.DSH_HOME
process.env.DSH_HOME = home
try {
  const requests = []
  const subagents = { async startActivation(request) {
    requests.push(request)
    return { childId: 'child-1', name: 'agent-1', result: Promise.resolve({ output: 'ok', stopReason: 'completed' }), async dispose() {} }
  } }
  apply({ tools: { register: tool => tools.set(tool.name, tool) }, skills: { registerProvider() {} }, get: name => ({ llm, subagents })[name], inject() {}, on() {} })
  const run = (name, args = {}) => tools.get(name).execute(args, { agent: { id: 'test-parent' }, signal: new AbortController().signal })
  const catalog = await run('pstack_catalog')
  assert.deepEqual(catalog.routes.map(r => [r.provider, r.model, r.efforts[0].id]), [
    ['codex', model, 'high'], ['private-proxy', model, 'high'],
  ])
  const overlayFor = reasoningEffort => ({ version: 1, roles: { 'feature, refactoring': { inherit: false, routes: [{ provider: 'codex', model, reasoningEffort }] } } })
  await assert.rejects(run('pstack_overlay_write', { overlay: overlayFor('low') }), /not accepted/)
  const { overlay } = await run('pstack_overlay_write', { overlay: overlayFor('high') })
  assert.deepEqual(overlay.roles['feature, refactoring'], overlayFor('high').roles['feature, refactoring'])
  assert.deepEqual((await run('pstack_overlay_read')).overlay.roles['feature, refactoring'], overlay.roles['feature, refactoring'])
  const task = { role: 'feature', description: 'Verify routed child', prompt: 'Reply with ok.' }
  assert.deepEqual(await run('pstack_spawn', task), { kind: 'activation', subagentId: 'child-1', name: 'agent-1', role: 'feature, refactoring', inherit: false })
  assert.deepEqual(requests[0].agentOptions, { provider: 'codex', model, reasoningEffort: 'high' })
  assert.equal(requests[0].delivery, 'parent')
  assert.equal((await run('pstack_spawn', { ...task, role: 'how-explorer', run_in_background: false })).output, 'ok')
  assert.equal(requests[1].delivery, 'caller')
  assert.equal('agentOptions' in requests[1], false)
  signedIn = false
  assert.deepEqual((await run('pstack_catalog')).routes.map(r => r.provider), ['private-proxy'])
  await assert.rejects(run('pstack_overlay_write', { overlay: overlayFor('high') }), /not listed by DSH/)
  console.log('PASS: Codex discovery, effort validation, save/read, Codex removal, and independent proxy discovery')
} finally {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  if (home.startsWith(join(tmpdir(), 'pstack-codex-test-'))) await rm(home, { recursive: true, force: true })
}
