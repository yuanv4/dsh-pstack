/** UI regression on the existing Host; all role data and test events stay in this browser context. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { emptyOverlay } from '../src/overlay-model.ts'

const { launchPinnedChromium } = await import(pathToFileURL(join(homedir(), '.codex/playwright-runtime/runtime.mjs')).href)
const candidate = process.argv[2] === undefined ? undefined : await readFile(resolve(process.argv[2]), 'utf8')
const origin = 'http://127.0.0.1:43127'
const base = {
  provider: 'deepseek-official', providerName: 'Fixture', model: 'fixture-base', modelName: 'Fixture base',
  efforts: [{ id: 'high', name: 'High' }],
}
const glm = {
  ...base, provider: 'pi-zai-coding-cn', model: 'glm-5.3-flash', modelName: 'GLM',
}
let routes = [base]
let requests = 0
let eventSeq = 0
let holdNext
let storedOverlay = emptyOverlay()
let storedDefault = false
let failDefault = false
let failOverlay = false
const writes = []
const snapshot = () => ({
  catalog: {
    routes, overlayPath: '(test-only)', overlayMissing: true, inheritParent: true,
  },
  overlay: storedOverlay, path: '(test-only)', missing: true, droppedRoles: [], potetoDefault: storedDefault,
})

const browser = await launchPinnedChromium()
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', error => { errors.push(error.message) })
  // Feed a synthetic Host notification into this page's real transport handler.
  // Replies for these synthetic RPC ids are suppressed; they never reach the Host.
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket
    window.__pstackTestHostSockets = []
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args) {
        super(...args)
        if (new URL(String(args[0]), location.href).pathname === '/api/events.host') window.__pstackTestHostSockets.push(this)
      }
      send(data) {
        if (typeof data === 'string') {
          let parsed
          try { parsed = JSON.parse(data) } catch { /* Non-JSON frames pass through unchanged. */ }
          if (String(parsed?.rpcId ?? '').startsWith('pstack-ui-fixture-')) return
        }
        return super.send(data)
      }
    }
  })
  await page.route(`${origin}/plugins/pstack-dsh/settings`, async route => {
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON()
      writes.push(body)
      assert.equal(Object.keys(body).length, 1, 'Each request saves one setting')
      const failed = 'overlay' in body ? failOverlay : failDefault
      if (failed) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'fixture write failure' }) })
      } else {
        if ('overlay' in body) storedOverlay = body.overlay
        else storedDefault = body.potetoDefault
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(
          'overlay' in body ? { path: '(test-only)', overlay: storedOverlay } : { potetoDefault: storedDefault },
        ) })
      }
      return
    }
    assert.equal(route.request().method(), 'GET')
    requests += 1
    const body = JSON.stringify(snapshot())
    if (holdNext !== undefined) {
      const wait = holdNext
      holdNext = undefined
      await wait
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body })
  })
  if (candidate !== undefined) {
    await page.route(/\/plugins\/pstack-dsh\/client\.js(?:\?.*)?$/, route =>
      route.fulfill({ status: 200, contentType: 'application/javascript', body: candidate }))
  }
  const notify = async (event = 'llm/adapters-updated', args = []) => {
    // An idle Host need not send any frame after the socket opens.
    await page.waitForFunction(() => window.__pstackTestHostSockets.some(socket => socket.readyState === WebSocket.OPEN))
    await page.evaluate(({ seq, event, args }) => {
      const socket = window.__pstackTestHostSockets.findLast(value => value.readyState === WebSocket.OPEN)
      if (socket === undefined) throw new Error('No active Host event socket')
      socket.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({
          type: 'server-request', rpcId: `pstack-ui-fixture-${seq}`, method: 'host/remote-event',
          payload: { type: 'host/remote-event', event, args },
        }),
      }))
    }, { seq: ++eventSeq, event, args })
  }
  const hasChoice = async (value, available = true) => {
    await page.waitForFunction(({ value, available }) => {
      const option = [...document.querySelectorAll('#pstack-role-feature-refactoring option')].find(entry => entry.value === value)
      return option !== undefined && option.disabled === !available
    }, { value, available }, { timeout: 6000 })
  }
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '插件', exact: true }).first().click()
  await page.getByRole('button', { name: /^查看 .*pstack/i }).first().click()
  // The bundle's configuration renders in the page body, not in a dialog.
  const config = page.locator('.pstack-page')
  await config.waitFor({ state: 'visible' })
  const feature = page.locator('#pstack-role-feature-refactoring')
  await feature.selectOption('deepseek-official::fixture-base')
  await page.locator('#pstack-effort-feature-refactoring').selectOption('high')
  assert.equal(await page.getByRole('button', { name: '保存', exact: true }).isEnabled(), true)

  routes = [base, glm]
  await notify()
  await hasChoice('pi-zai-coding-cn::glm-5.3-flash')
  assert.equal(await feature.inputValue(), 'deepseek-official::fixture-base')
  assert.equal(await page.locator('#pstack-effort-feature-refactoring').inputValue(), 'high')
  assert.equal(await page.getByRole('button', { name: '保存', exact: true }).isEnabled(), true)

  const beforeManual = requests
  const manualResponse = page.waitForResponse(response => response.url() === `${origin}/plugins/pstack-dsh/settings`)
  // The page header carries its own 刷新, so this one is scoped to the form.
  await page.locator('.pstack-tools').getByRole('button', { name: '刷新', exact: true }).click()
  await manualResponse
  assert.ok(requests > beforeManual)
  assert.equal(await feature.inputValue(), 'deepseek-official::fixture-base')
  assert.equal(await page.locator('#pstack-effort-feature-refactoring').inputValue(), 'high')

  routes = [glm]
  await notify('llm/models-updated', ['deepseek-official'])
  await hasChoice('deepseek-official::fixture-base', false)
  assert.equal(await feature.inputValue(), 'deepseek-official::fixture-base')
  assert.match(await feature.locator('option:checked').innerText(), /已不在列表/)

  routes = [base, glm]
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')) })
  await hasChoice('deepseek-official::fixture-base')
  assert.equal(await page.locator('#pstack-effort-feature-refactoring').inputValue(), 'high')

  // A slow pre-change snapshot must not replace a newer catalog.
  let release
  holdNext = new Promise(resolve => { release = resolve })
  routes = [base, glm, { ...glm, model: 'stale-fixture' }]
  const beforeSlow = requests
  await notify()
  await page.waitForTimeout(100)
  assert.ok(requests > beforeSlow)
  routes = [base, glm, { ...glm, model: 'latest-fixture' }]
  await notify()
  await hasChoice('pi-zai-coding-cn::latest-fixture')
  release()
  await page.waitForTimeout(100)
  assert.equal(await feature.locator('option[value="pi-zai-coding-cn::stale-fixture"]').count(), 0)

  // Leaving the page owns the draft: the form unmounts, unsubscribes, and the
  // staged edit is gone when the page is opened again.
  await page.getByRole('button', { name: /返回插件/ }).click()
  await config.waitFor({ state: 'hidden' })
  const afterLeave = requests
  await notify()
  await page.waitForTimeout(100)
  assert.equal(requests, afterLeave, 'Leaving the page must unsubscribe')
  assert.deepEqual(errors, [])

  await page.getByRole('button', { name: /^查看 .*pstack/i }).first().click()
  await config.waitFor({ state: 'visible' })
  assert.equal(await feature.inputValue(), 'inherit-parent', 'staged edit dropped on leave')
  assert.equal(await page.locator('#pstack-effort-feature-refactoring').count(), 0)
  assert.equal(await page.getByRole('button', { name: '保存', exact: true }).isDisabled(), true)
  assert.deepEqual(errors, [])
  const save = page.getByRole('button', { name: '保存', exact: true })
  const discard = page.getByRole('button', { name: '还原', exact: true })
  const defaultToggle = page.getByRole('switch', { name: '新会话默认启用 poteto 工作流', exact: true })
  await defaultToggle.click()
  await save.click()
  await page.waitForFunction(() => document.querySelector('.pstack-banner--ok') !== null)
  assert.deepEqual(writes.splice(0), [{ potetoDefault: true }], 'Default-only save never sends roles')
  assert.equal(await save.isDisabled(), true)

  await feature.selectOption('deepseek-official::fixture-base')
  await defaultToggle.click()
  failDefault = true
  await save.click()
  await page.waitForFunction(() => document.querySelector('.pstack-banner--error')?.textContent.includes('部分更改已保存'))
  assert.equal(writes.length, 2)
  assert.equal(storedDefault, true)
  assert.equal(storedOverlay.roles['feature, refactoring'].routes[0].model, 'fixture-base')
  assert.equal(await save.isEnabled(), true)
  writes.length = 0
  failDefault = false
  await save.click()
  await page.waitForFunction(() => document.querySelector('.pstack-banner--ok') !== null)
  assert.deepEqual(writes.splice(0), [{ potetoDefault: false }], 'Retry saves only the failed setting')

  await feature.selectOption('pi-zai-coding-cn::glm-5.3-flash')
  await defaultToggle.click()
  failOverlay = true
  await save.click()
  await page.waitForFunction(() => document.querySelector('.pstack-banner--error')?.textContent.includes('部分更改已保存'))
  assert.equal(storedDefault, true)
  assert.equal(storedOverlay.roles['feature, refactoring'].routes[0].model, 'fixture-base')
  await discard.click()
  assert.equal(await feature.inputValue(), 'deepseek-official::fixture-base')
  assert.equal(await defaultToggle.getAttribute('aria-checked'), 'true', 'Discard retains the saved default')
  assert.equal(await save.isDisabled(), true)
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({
    url: origin, candidate: candidate !== undefined, simulatedHostNotifications: true,
    automaticModelUpdate: true, stagedEditsDroppedOnLeave: true,
    logoutChoiceMarked: true, staleResponseIgnored: true, unsubscribedOnLeave: true,
    defaultOnlySave: true, partialSaveRetry: true, partialSaveDiscard: true, hostWrites: 0,
  }, null, 2))
} finally {
  await browser.close()
}

