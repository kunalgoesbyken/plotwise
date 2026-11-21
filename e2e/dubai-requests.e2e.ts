import { encodeRegion } from '../src/editor/plot-url'
import { designTable, goTo, openApp, READY_TIMEOUT, showTab } from './support/app'
import { mockApp } from './support/site'
import { expect, test } from './support/test'

test('the Dubai example loads every request it makes and logs no console error, whichever origin it comes from', async ({ page, context }) => {
  const failed: string[] = []
  const logged: string[] = []
  context.on('response', (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') logged.push(`${message.text()} ${message.location().url}`)
  })
  await mockApp(page)
  await openApp(page, `${encodeRegion('dxb')}&example`)
  await goTo(page, 'Results')
  await expect(designTable(page)).toBeAttached({ timeout: READY_TIMEOUT })
  for (const tab of ['Money', 'Rules', 'Designs'] as const) await showTab(page, tab)
  expect(failed, 'responses with an error status').toEqual([])
  expect(logged, 'console errors').toEqual([])
})
