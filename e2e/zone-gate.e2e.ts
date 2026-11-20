import type { Page } from '@playwright/test'
import { EXAMPLE_FRAGMENT } from '../src/editor/plot-url'
import { EXAMPLE_PLOT } from '../src/plot/example-plot'
import { REGIONS } from '../src/region/regions'
import { ZONE_SOURCES } from '../src/zone/sources'
import { mockSite } from './app-fixtures'
import { READY_TIMEOUT, designTable, designsRegion, dragBy, hashParams, openApp, openResults, settledCorner, summary, zoneCheck } from './support/app'
import { RESULTS_PLOT, hashOf } from './support/site'
import { expect, test } from './support/test'
import { BLUE_ZONE, BROWN_ZONE, SNAPSHOT_DOWN_MESSAGE, mockZoneDown, mockZoneSnapshotCovering, mockZoneSnapshotDown, mockZoneStrips } from './zone-layers'

const CONFIRM = 'I checked: the plot is in this zone'
const NOTHING_TO_SHOW = 'Results appear once the zone is confirmed.'
const SNAPSHOT_DATE = 'BMA city-plan layer as of Nov 20, 2026.'
const LIVE_DIFFERS = "The live BMA city-plan layer answers differently from Plotwise's copy of Nov 20, 2026, which this check follows."
const OFFICIAL_MAP = `Confirm it on the ${REGIONS.bkk.cityPlan?.name}.`
const SNAPSHOT_DELAY_MS = 1_500
const UNKNOWN_ZONE_CODE = 'XX'
const DRAG_PX = 80

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  await mockSite(page)
})

async function recordGateSightings(page: Page) {
  await page.addInitScript(
    ({ confirm, nothingToShow }) => {
      const seen = { region: false, confirm: false, holdCopy: false }
      Object.assign(window, { zoneGateSeen: seen })
      new MutationObserver(() => {
        if (document.querySelector('section[aria-label="Zone check"]')) seen.region = true
        if ([...document.querySelectorAll('button')].some((button) => button.textContent === confirm)) seen.confirm = true
        if (document.body?.textContent?.includes(nothingToShow)) seen.holdCopy = true
      }).observe(document, { childList: true, subtree: true, characterData: true })
    },
    { confirm: CONFIRM, nothingToShow: NOTHING_TO_SHOW },
  )
  return () => page.evaluate(() => (window as unknown as { zoneGateSeen: Record<string, boolean> }).zoneGateSeen)
}

async function delaySnapshot(page: Page) {
  await page.route(`**${ZONE_SOURCES.bkk.snapshot}`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, SNAPSHOT_DELAY_MS))
    await route.continue()
  })
}

test('a plot inside the covered zone shows its figures without asking for a confirmation', async ({ page }) => {
  await mockZoneStrips(page, 'bkk', [{ code: BROWN_ZONE, width: 1 }])
  await openResults(page, hashOf(EXAMPLE_PLOT))
  await expect(zoneCheck(page)).toHaveCount(0)
  await expect(summary(page)).toContainText('Inside the brown zone 9 (very high-density residential). Plotwise covers this zone.')
  await expect(summary(page)).toContainText('You can build up to')
  await expect(summary(page)).not.toContainText(LIVE_DIFFERS)
  expect(hashParams(page).zone).toBeUndefined()
})

test('the example plot never shows the zone gate, even while the snapshot loads and the BMA layer cannot be reached', async ({ page }) => {
  const gateSeen = await recordGateSightings(page)
  await delaySnapshot(page)
  await mockZoneDown(page, 'bkk')
  await openApp(page, EXAMPLE_FRAGMENT)
  await expect(summary(page)).toContainText('You can build up to', { timeout: READY_TIMEOUT })
  await expect(summary(page)).toContainText('Inside the brown zone 9 (very high-density residential). Plotwise covers this zone.')
  await expect(summary(page)).toContainText(SNAPSHOT_DATE)
  expect(await gateSeen()).toEqual({ region: false, confirm: false, holdCopy: false })
})

test('a plot across the brown-zone boundary is held without an override when the BMA layer cannot be reached', async ({ page }) => {
  await mockZoneDown(page, 'bkk')
  await openApp(page, hashOf(RESULTS_PLOT))
  await expect(zoneCheck(page)).toContainText(/This plot spans more than one zone: brown zone 9 \(very high-density residential\) \(\d+%\), other zones \(\d+%\)/)
  await expect(zoneCheck(page)).toContainText(SNAPSHOT_DATE)
  await expect(zoneCheck(page).getByRole('button')).toHaveCount(0)
  await expect(designTable(page)).toHaveCount(0)
})

test('a live layer that places the example plot elsewhere is noted, with the official map, while the snapshot keeps it inside', async ({ page }) => {
  await mockZoneStrips(page, 'bkk', [{ code: BLUE_ZONE, width: 1 }])
  await openResults(page, hashOf(EXAMPLE_PLOT))
  await expect(summary(page)).toContainText('Inside the brown zone 9 (very high-density residential). Plotwise covers this zone.')
  await expect(summary(page)).toContainText(LIVE_DIFFERS)
  await expect(summary(page).getByRole('link', { name: OFFICIAL_MAP })).toHaveAttribute('href', REGIONS.bkk.cityPlan?.url ?? '')
  await expect(zoneCheck(page)).toHaveCount(0)
})

test('a live layer that calls a straddling plot inside cannot clear it', async ({ page }) => {
  await mockZoneStrips(page, 'bkk', [{ code: BROWN_ZONE, width: 1 }])
  await openApp(page, hashOf(RESULTS_PLOT))
  await expect(zoneCheck(page)).toContainText('This plot spans more than one zone')
  await expect(zoneCheck(page)).toContainText(LIVE_DIFFERS)
  await expect(zoneCheck(page).getByRole('button')).toHaveCount(0)
  await expect(designTable(page)).toHaveCount(0)
})

const UNCHECKED_ZONES = [
  { reason: 'the layer has no zone at the plot', strips: [] },
  { reason: 'the layer names a zone Plotwise does not know', strips: [{ code: UNKNOWN_ZONE_CODE, width: 1 }] },
] as const

test.describe('without the zone snapshot', () => {
  test.use({ allowedConsoleMessages: [SNAPSHOT_DOWN_MESSAGE] })

  test.beforeEach(async ({ page }) => {
    await mockZoneSnapshotDown(page, 'bkk')
  })

  for (const { reason, strips } of UNCHECKED_ZONES)
    test(`a zone that could not be checked (${reason}) holds the figures until the user confirms it`, async ({ page }) => {
      await mockZoneStrips(page, 'bkk', strips)
      await openApp(page, hashOf(RESULTS_PLOT))
      await expect(zoneCheck(page)).toContainText('Not checked')
      await expect(zoneCheck(page).getByRole('button', { name: CONFIRM })).toBeVisible()
      await expect(designTable(page)).toHaveCount(0)
      await expect(designsRegion(page).getByText(NOTHING_TO_SHOW)).toBeVisible()

      await zoneCheck(page).getByRole('button', { name: CONFIRM }).click()
      await expect(designTable(page)).toBeAttached({ timeout: READY_TIMEOUT })
      await expect(zoneCheck(page)).toHaveCount(0)
      expect(hashParams(page).zone).toBe('confirmed')
    })

  test('a zone the user confirmed reads "Confirmed by you" in the results, the checklist and the print', async ({ page }) => {
    await mockZoneDown(page, 'bkk')
    await openApp(page, hashOf(RESULTS_PLOT))
    await zoneCheck(page).getByRole('button', { name: CONFIRM }).click()
    await expect(designTable(page)).toBeAttached({ timeout: READY_TIMEOUT })

    await expect(summary(page)).toContainText('Confirmed by you')
    await expect(summary(page)).not.toContainText('Not checked')
    await designsRegion(page).getByRole('button', { name: /^Checklist for / }).click()
    await expect(designsRegion(page)).toContainText('Confirmed by you')

    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('article')).toContainText('Confirmed by you')
    await expect(page.locator('article')).not.toContainText('Not checked')
  })
})

test('moving a corner out of the covered zone withdraws the figures and the printed summary', async ({ page }) => {
  const [west, south] = [Math.min(...RESULTS_PLOT.ring.map(([lng]) => lng)), Math.min(...RESULTS_PLOT.ring.map(([, lat]) => lat))]
  const [east, north] = [Math.max(...RESULTS_PLOT.ring.map(([lng]) => lng)), Math.max(...RESULTS_PLOT.ring.map(([, lat]) => lat))]
  await mockZoneSnapshotCovering(page, 'bkk', [west - 0.01, south - 0.01, east, north + 0.01])
  await mockZoneDown(page, 'bkk')
  await openResults(page, hashOf(RESULTS_PLOT))
  await expect(summary(page)).toContainText('You can build up to')

  const [x, y] = await settledCorner(page, 'C')
  await dragBy(page, [x, y], [DRAG_PX, 0])
  await expect(zoneCheck(page)).toContainText('This plot spans more than one zone')
  await expect(designTable(page)).toHaveCount(0)

  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Plotwise · Bangkok plot summary' })).toHaveCount(0)
})
