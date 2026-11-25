import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, mock } from 'node:test'
import type { Context } from '@deepseek-ai/cordis'
import { SETTINGS_SNAPSHOT_PATH } from '../src/ids.ts'
import { DEFAULT_SETTINGS_FILENAME } from '../src/poteto-default.ts'
import { registerPstackSettingsRoutes } from '../src/settings-routes.ts'
import type { CatalogHost } from '../src/catalog.ts'

type Handler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>

describe('settings route authentication', () => {
  it('returns Connection 401/403 without reading or writing settings', async () => {
    for (const rejection of [401, 403] as const) {
      let handler: Handler | undefined
      const requestRejection = mock.fn(() => rejection)
      const ctx = {
        connection: { requestRejection },
        webServer: {
          register: (route: { handler: Handler }) => {
            handler = route.handler
            return () => {}
          },
        },
        effect: (factory: () => () => void) => { factory() },
      } as unknown as Context
      const host = new Proxy({}, {
        get() { throw new Error('settings host must not be touched') },
      }) as CatalogHost
      registerPstackSettingsRoutes(ctx, host)

      const socket = new Socket()
      const req = new IncomingMessage(socket)
      for (const method of ['GET', 'POST']) {
        req.method = method
        req.url = SETTINGS_SNAPSHOT_PATH
        req.headers = { host: '127.0.0.1:43127' }
        const res = new ServerResponse(req)
        let body = ''
        mock.method(res, 'writeHead', (status: number) => { res.statusCode = status; return res })
        mock.method(res, 'end', (chunk?: unknown) => { body = String(chunk ?? ''); return res })
        await handler?.(req, res)

        assert.equal(res.statusCode, rejection)
        assert.deepEqual(JSON.parse(body), { error: rejection === 401 ? 'unauthorized' : 'forbidden' })
      }
      socket.destroy()
      assert.equal(requestRejection.mock.callCount(), 2)
    }
  })
})

function settingsContext(): { ctx: Context; handler: () => Handler } {
  let handler: Handler | undefined
  const ctx = {
    connection: { requestRejection: () => undefined },
    webServer: {
      register: (route: { handler: Handler }) => {
        handler = route.handler
        return () => {}
      },
    },
    effect: (factory: () => () => void) => { factory() },
  } as unknown as Context
  return {
    ctx,
    handler: () => {
      assert.ok(handler)
      return handler
    },
  }
}

async function request(handler: Handler, method: string, body?: unknown): Promise<{ status: number; body: unknown }> {
  const socket = new Socket()
  const req = new IncomingMessage(socket)
  req.method = method
  req.url = SETTINGS_SNAPSHOT_PATH
  req.headers = { host: '127.0.0.1:43127' }
  if (body !== undefined) req.push(JSON.stringify(body))
  req.push(null)
  const res = new ServerResponse(req)
  let text = ''
  mock.method(res, 'writeHead', (status: number) => { res.statusCode = status; return res })
  mock.method(res, 'end', (chunk?: unknown) => { text = String(chunk ?? ''); return res })
  await handler(req, res)
  socket.destroy()
  return { status: res.statusCode, body: JSON.parse(text) as unknown }
}

function catalogHost(home: string): CatalogHost {
  return {
    dshHome: home,
    env: {},
    llm: {
      listProviders: () => [{ id: 'deepseek-official', name: 'DeepSeek' }],
      async listModels() { return [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }] },
      async resolveModelInfo() { return { id: 'deepseek-chat', name: 'DeepSeek Chat' } },
    },
  } as unknown as CatalogHost
}

describe('settings route save body', () => {
  it('round-trips the overlay and the new-session default', async () => {
    const home = await mkdtemp(join(tmpdir(), 'pstack-dsh-route-default-'))
    try {
      const { ctx, handler } = settingsContext()
      registerPstackSettingsRoutes(ctx, catalogHost(home))
      const combined = await request(handler(), 'PUT', {
        overlay: { version: 1, roles: {} }, potetoDefault: true,
      })
      assert.equal(combined.status, 400)
      const save = await request(handler(), 'PUT', { overlay: { version: 1, roles: {} } })
      assert.equal(save.status, 200)
      const body = save.body as { path?: unknown; overlay?: { version?: unknown; roles?: Record<string, unknown> }; potetoDefault?: unknown }
      assert.equal(typeof body.path, 'string')
      assert.equal(body.overlay?.version, 1)
      assert.deepEqual(body.overlay?.roles?.['feature, refactoring'], { inherit: true, routes: [] })
      const defaults = await request(handler(), 'PUT', { potetoDefault: true })
      assert.equal(defaults.status, 200)
      assert.deepEqual(defaults.body, { potetoDefault: true })
      assert.match(await readFile(join(home, DEFAULT_SETTINGS_FILENAME), 'utf8'), /"potetoDefault": true/)
      const snapshot = await request(handler(), 'GET')
      assert.equal(snapshot.status, 200)
      assert.equal((snapshot.body as { potetoDefault?: unknown }).potetoDefault, true)
    } finally {
      await rm(home, { recursive: true, force: true })
    }
  })
})
