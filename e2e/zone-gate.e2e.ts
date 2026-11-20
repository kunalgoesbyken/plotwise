import { mockSite } from './app-fixtures'
import { READY_TIMEOUT, designTable, designsRegion, dragBy, hashParams, openApp, openResults, settledCorner, summary, zoneCheck } from './support/app'
import { RESULTS_PLOT, hashOf } from './support/site'
import { expect, test } from './support/test'
import { BLUE_ZONE, BROWN_ZONE, mockZoneStrips } from './zone-layers'

const CONFIRM = 'I checked: the plot is in this zone'
const NOTHING_TO_SHOW = 'Results appear once the zone is confirmed.'
const UNKNOWN_ZONE_CODE = 'XX'
const DRAG_PX = 40

test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  await mockSite(page)
})

test('a plot inside the covered zone shows its figures without asking for a confirmation', async ({ page }) => {
  await mockZoneStrips(page, 'bkk', [{ code: BROWN_ZONE, width: 1 }])
  await openResults(page, hashOf(RESULTS_PLOT))
  await expect(zoneCheck(page)).toHaveCount(0)
  await expect(summary(page)).toContainText('Inside the brown zone 9 (very high-density residential). Plotwise covers this zone.')
  await expect(summary(page)).toContainText('You can build up to')
  expect(hashParams(page).zone).toBeUndefined()
})

const UNCHECKED_ZONES = [
  { reason: 'the layer has no zone at the plot', strips: [] },
  { reason: 'the layer names a zone Plotwise does not know', strips: [{ code: UNKNOWN_ZONE_CODE, width: 1 }] },
] as const

for (const { reason, strips } of UNCHECKED_ZONES)
  test(`a zone that could not be checked (${reason}) holds the figures until the user confirms it`, async ({ page }) => {
    await mockZoneStrips(page, 'bkk', strips)
    await openApp(page, hashOf(RESULTS_PLOT))
    await expect(zoneCheck(page).getByRole('button', { name: CONFIRM })).toBeVisible()
    await expect(designTable(page)).toHaveCount(0)
    await expect(designsRegion(page).getByText(NOTHING_TO_SHOW)).toBeVisible()

    await zoneCheck(page).getByRole('button', { name: CONFIRM }).click()
    await expect(designTable(page)).toBeAttached({ timeout: READY_TIMEOUT })
    await expect(zoneCheck(page)).toHaveCount(0)
    expect(hashParams(page).zone).toBe('confirmed')
  })

test('moving a corner out of the covered zone withdraws the figures and the printed summary', async ({ page }) => {
  await mockZoneStrips(page, 'bkk', [{ code: BROWN_ZONE, width: 1 }])
  await openResults(page, hashOf(RESULTS_PLOT))
  await expect(summary(page)).toContainText('You can build up to')

  await mockZoneStrips(page, 'bkk', [{ code: BLUE_ZONE, width: 1 }])
  const [x, y] = await settledCorner(page, 'C')
  await dragBy(page, [x, y], [DRAG_PX, DRAG_PX])
  await expect(zoneCheck(page)).toContainText('This plot is in the blue zone')
  await expect(designTable(page)).toHaveCount(0)

  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Plotwise · Bangkok plot summary' })).toHaveCount(0)
})
