/** Same-origin session switch. State lives in `$DSH_HOME/pstack-poteto.json`. */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { POTETO_STATE_PATH } from './ids.ts'
import { json, readJson, trustedRequest } from './http-trust.ts'
import type { PotetoSwitch } from './poteto-mode.ts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function handle(switchApi: PotetoSwitch, req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'GET') {
    const url = new URL(req.url ?? POTETO_STATE_PATH, 'http://localhost')
    const session = url.searchParams.get('session') ?? ''
    if (session === '') {
      json(res, 400, { error: 'session is required' })
      return
    }
    json(res, 200, { session, ...switchApi.read(session) })
    return
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    try {
      const body = await readJson(req)
      const session = isRecord(body) && typeof body.session === 'string' ? body.session : ''
      const enabled = isRecord(body) && typeof body.enabled === 'boolean' ? body.enabled : undefined
      if (session === '' || enabled === undefined) {
        json(res, 400, { error: 'session and enabled are required' })
        return
      }
      json(res, 200, { session, ...await switchApi.setEnabled(session, enabled) })
    } catch (error: unknown) {
      json(res, 400, { error: error instanceof Error ? error.message : 'switch failed' })
    }
    return
  }
  json(res, 405, { error: 'method not allowed' })
}

export function registerPstackPotetoRoutes(ctx: Context, switchApi: PotetoSwitch): void {
  const webServer = ctx.webServer
  if (webServer === undefined) return
  ctx.effect(() => {
    const routes = [
      webServer.register({
        kind: 'exact',
        path: POTETO_STATE_PATH,
        handler: async (req, res) => {
          const rejection = ctx.connection.requestRejection(req)
          if (rejection !== undefined) {
            json(res, rejection, { error: rejection === 401 ? 'unauthorized' : 'forbidden' })
            return
          }
          if (!trustedRequest(req)) {
            json(res, 403, { error: 'forbidden' })
            return
          }
          await handle(switchApi, req, res)
        },
      }),
    ]
    return () => {
      for (const dispose of routes) dispose()
    }
  }, 'dsh-pstack: poteto switch route')
}
