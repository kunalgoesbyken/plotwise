import { DEVICES, DRAWN_PLOT, READY_TIMEOUT, allowedArea, designTable, drawPlot, dragBy, frontageWidth, goTo, hint, openApp, plotInUrl, settledCorner, summary } from './support/app'
import { mockApp } from './support/site'
import { expect, test } from './support/test'

const DRAG_PX = 30
const EDGE_CLICK_AT = 0.25

for (const device of DEVICES)
  test.describe(`plot editing on ${device.name}`, () => {
    test.use({ viewport: { width: device.width, height: device.height } })

    test('draws a plot, drags a corner, marks a road, changes its width and reaches the results', async ({ page }) => {
      await mockApp(page)
      await openApp(page)

      await test.step('click the corners of a plot', async () => {
        await drawPlot(page, device)
        await expect(page.locator('.map-label-corner')).toHaveCount(DRAWN_PLOT.length)
        await expect(hint(page)).toContainText('edge that faces a road')
      })

      await test.step('drag one corner to a new place', async () => {
        const [x, y] = await settledCorner(page, 'C')
        await dragBy(page, [x, y], [DRAG_PX, -DRAG_PX])
        const [movedX, movedY] = await settledCorner(page, 'C')
        expect(Math.abs(movedX - (x + DRAG_PX))).toBeLessThanOrEqual(2)
        expect(Math.abs(movedY - (y - DRAG_PX))).toBeLessThanOrEqual(2)
        await expect(page.locator('.map-label-corner')).toHaveCount(DRAWN_PLOT.length)
      })

      await test.step('mark an edge as a road and change its width', async () => {
        const [[ax, ay], [bx, by]] = [await settledCorner(page, 'A'), await settledCorner(page, 'B')]
        await page.mouse.click(ax + (bx - ax) * EDGE_CLICK_AT, ay + (by - ay) * EDGE_CLICK_AT)
        await expect(frontageWidth(page, 'A–B')).toBeFocused()
        await frontageWidth(page, 'A–B').fill('16')
        await expect.poll(async () => (await plotInUrl(page))?.roads).toEqual([{ edge: 0, widthM: 16 }])
        await frontageWidth(page, 'A–B').fill('10')
        await expect.poll(async () => (await plotInUrl(page))?.roads).toEqual([{ edge: 0, widthM: 10 }])
      })

      await test.step('see what the plot can hold', async () => {
        await page.getByRole('button', { name: 'See results' }).click()
        await expect(designTable(page)).toBeAttached({ timeout: READY_TIMEOUT })
        await expect(summary(page)).toContainText(/legal cap/i)
        expect(await allowedArea(page)).toBeGreaterThan(0)
      })

      await test.step('the road width is still there when going back to the roads step', async () => {
        await goTo(page, 'Roads')
        await expect(frontageWidth(page, 'A–B')).toHaveValue('10')
      })
    })
  })
