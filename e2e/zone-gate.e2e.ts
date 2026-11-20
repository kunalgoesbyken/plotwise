import { designTable, designsRegion, dragBy, openApp, openResults, settledCorner, summary, zoneCheck } from './support/app'
import { CHATUCHAK_PARK_PLOT, INSIDE, MIXED, OUTSIDE, RESULTS_PLOT, hashOf, mockApp, unchecked } from './support/site'
import { expect, test } from './support/test'

const CONFIRM = 'I checked: the plot is in this zone'
const NOTHING_TO_SHOW = 'Results appear once the zone is confirmed.'
const DRAG_PX = 40

test.use({ viewport: { width: 1440, height: 900 } })

const hashParams = (url: string) => Object.fromEntries(new URLSearchParams(new URL(url).hash.slice(1)))

test('a plot inside the covered zone shows its figures without asking for a confirmation', async ({ page }) => {
  const asked = await mockApp(page, INSIDE)
  await openResults(page, hashOf(RESULTS_PLOT))
  await expect(zoneCheck(page)).toHaveCount(0)
  await expect(summary(page)).toContainText('Inside the brown zone 9 (very high-density residential). Plotwise covers this zone.')
  await expect(summary(page)).toContainText('You can build up to')
  expect(hashParams(page.url()).zone).toBeUndefined()
  expect(asked).toHaveLength(1)
  expect(new URL(asked[0]).searchParams.get('ring')).toContain('100.5686')
})

test('a plot in Chatuchak Park is blocked with the outside message and no figures', async ({ page }) => {
  await mockApp(page, OUTSIDE)
  await openApp(page, hashOf(CHATUCHAK_PARK_PLOT))
  const held = zoneCheck(page)
  await expect(held).toContainText('This plot is in the blue zone. Plotwise covers only the brown zone 9 (very high-density residential) for now.')
  await expect(held).toContainText('Plotwise shows no floor area, designs or money for a plot outside the zone it covers.')
  await expect(held.getByRole('button')).toHaveCount(0)
  await expect(designTable(page)).toHaveCount(0)
  await expect(page.getByText('You can build up to')).toHaveCount(0)
  await expect(designsRegion(page).getByText(NOTHING_TO_SHOW)).toBeVisible()

  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'Plotwise · Bangkok plot summary' })).toHaveCount(0)
})

test('a plot spanning two zones gets a warning and no figures', async ({ page }) => {
  await mockApp(page, MIXED)
  await openApp(page, hashOf(RESULTS_PLOT))
  const held = zoneCheck(page)
  await expect(held).toContainText('This plot spans more than one zone')
  await expect(held).toContainText('the whole plot must lie inside it')
  await expect(held.getByRole('button')).toHaveCount(0)
  await expect(designTable(page)).toHaveCount(0)
  await expect(page.getByText('You can build up to')).toHaveCount(0)
})

for (const reason of ['no-region', 'no-zone', 'unrecognised'] as const)
  test(`a zone that could not be checked (${reason}) holds the figures until the user confirms it`, async ({ page }) => {
    await mockApp(page, unchecked(reason))
    await openApp(page, hashOf(RESULTS_PLOT))
    await expect(zoneCheck(page).getByRole('button', { name: CONFIRM })).toBeVisible()
    await expect(designTable(page)).toHaveCount(0)
    await expect(designsRegion(page).getByText(NOTHING_TO_SHOW)).toBeVisible()

    await zoneCheck(page).getByRole('button', { name: CONFIRM }).click()
    await expect(designTable(page)).toBeAttached({ timeout: 30_000 })
    await expect(zoneCheck(page)).toHaveCount(0)
    expect(hashParams(page.url()).zone).toBe('confirmed')
  })

test('moving a corner out of the covered zone withdraws the figures', async ({ page }) => {
  let verdict: object = INSIDE
  await mockApp(page, () => verdict)
  await openResults(page, hashOf(RESULTS_PLOT))
  await expect(summary(page)).toContainText('You can build up to')

  verdict = OUTSIDE
  const [x, y] = await settledCorner(page, 'C')
  await dragBy(page, [x, y], [DRAG_PX, DRAG_PX])
  await expect(zoneCheck(page)).toContainText('This plot is in the blue zone')
  await expect(designTable(page)).toHaveCount(0)
})
