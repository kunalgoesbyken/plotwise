import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { openExample } from './app-fixtures'

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const BLOCKING = new Set(['serious', 'critical'])

async function blockingViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  return violations
    .filter((violation) => BLOCKING.has(violation.impact ?? ''))
    .map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map((node) => node.target.join(' ')) }))
}

const viewports = [
  { name: 'desktop', width: 1440, height: 900, tabs: ['Designs', 'Money', 'Rules'] },
  { name: 'phone', width: 375, height: 812, tabs: ['Designs', 'Money', 'Rules', '3D'] },
] as const

test('the landing page has no serious or critical accessibility issues', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(await blockingViolations(page)).toEqual([])
})

test('the not-found page has no serious or critical accessibility issues', async ({ page }) => {
  await page.goto('/no-such-page')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(await blockingViolations(page)).toEqual([])
})

for (const { name, width, height, tabs } of viewports) {
  test(`the app has no serious or critical accessibility issues at ${name} size, on every tab`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openExample(page)
    for (const tab of tabs) {
      await page.getByRole('tab', { name: tab, exact: true }).click()
      if (tab === '3D') await expect(page.locator('[data-scene-ready="true"]')).toBeAttached({ timeout: 30_000 })
      expect(await blockingViolations(page), `tab ${tab}`).toEqual([])
    }
    for (const step of ['Roads', 'Plot']) {
      await page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: step }).click()
      expect(await blockingViolations(page), `step ${step}`).toEqual([])
    }
  })
}
