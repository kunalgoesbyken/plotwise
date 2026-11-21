import { encodeRegion } from '../src/editor/plot-url'
import { designTable, goTo, openApp, READY_TIMEOUT, showTab } from './support/app'
import { mockZoneInside } from './app-fixtures'
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

test('switching from the Mumbai example to the Dubai example never asks the site service about one region’s plot with the other region’s rules', async ({ page }) => {
  const refused: string[] = []
  page.on('response', (response) => {
    if (response.url().includes('/api/site') && response.status() === 400) refused.push(response.url())
  })
  await mockZoneInside(page)
  await openApp(page, `${encodeRegion('mum')}&example`)
  await expect(page.locator('[data-map-ready="true"]')).toBeAttached()
  await page.evaluate((hash) => {
    location.hash = hash
  }, `${encodeRegion('dxb')}&example`)
  await goTo(page, 'Results')
  await expect(designTable(page)).toBeAttached({ timeout: READY_TIMEOUT })
  await page.waitForLoadState('networkidle')
  expect(refused, '400 answers from the site service').toEqual([])
})
