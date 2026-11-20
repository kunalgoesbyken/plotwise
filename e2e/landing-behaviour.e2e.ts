import type { Page } from '@playwright/test'
import { expectNoSeriousViolations } from './support/axe'
import { DEVICES, READY_TIMEOUT, designTable } from './support/app'
import { mockApp } from './support/site'
import { expect, test } from './support/test'

const REPO = 'https://github.com/kunalgoesbyken/plotwise'

const UNUSED_MAPLIBRE_CSS_PRELOAD =
  'The resource http://localhost/_next/static/chunks/maplibre.css was preloaded using link preload but not used within a few seconds from the window\'s load event. Please make sure it has an appropriate `as` value and it is preloaded intentionally.'

const mainButtons = (page: Page) => page.getByRole('main').getByRole('button')
const collapsedQuestions = (page: Page) => mainButtons(page).and(page.locator('[aria-expanded="false"]'))
const question = (page: Page, name: string) => page.getByRole('main').getByRole('button', { name, exact: true })

async function scrollThroughPage(page: Page) {
  await page.evaluate(async () => {
    const nextFrame = () => new Promise(requestAnimationFrame)
    for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
      scrollTo(0, y)
      await nextFrame()
    }
    scrollTo(0, 0)
  })
}

const finiteAnimationsRunning = (page: Page) =>
  page.evaluate(() => document.getAnimations().filter(({ playState, effect }) => playState === 'running' && Number.isFinite(effect?.getComputedTiming().endTime)).length)

const imagesNotLoaded = (page: Page) =>
  page.evaluate(() => [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.currentSrc || image.src))

for (const device of DEVICES)
  test.describe(`landing on ${device.name}`, () => {
    test.use({ viewport: { width: device.width, height: device.height }, allowedConsoleMessages: [UNUSED_MAPLIBRE_CSS_PRELOAD] })

    test.beforeEach(async ({ page }) => {
      await mockApp(page)
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    })

    test('every in-page link in the header scrolls its section into view', async ({ page }) => {
      const visibleLinks = page.getByRole('banner').getByRole('link').filter({ visible: true })
      const hrefs = (await visibleLinks.evaluateAll((links) => links.map((link) => link.getAttribute('href')))).filter((href) => href?.startsWith('#'))
      if (!device.isPhone) expect(hrefs.length).toBeGreaterThan(0)
      for (const href of hrefs) {
        await page.goto('/')
        await page.getByRole('banner').locator(`a[href="${href}"]`).click()
        await expect(page).toHaveURL(new RegExp(`${href}$`))
        await expect(page.locator(href!)).toBeInViewport()
      }
    })

    test('every source link goes to the GitHub repository', async ({ page }) => {
      const links = page.getByRole('link', { name: /github|source/i })
      expect(await links.count()).toBeGreaterThan(0)
      for (const link of await links.all()) await expect(link).toHaveAttribute('href', REPO)
    })

    for (const name of ['Open the app', 'Draw your own'])
      test(`"${name}" opens the empty editor`, async ({ page }) => {
        await page.getByRole('link', { name }).first().click()
        await expect(page).toHaveURL(/\/app$/)
        await page.locator('[data-map-ready="true"]').waitFor()
        await expect(page.getByRole('region', { name: 'Find the site' })).toBeVisible()
      })

    test('every "Try the example plot" link opens the example with its designs', async ({ page }) => {
      const examples = await page.getByRole('link', { name: 'Try the example plot' }).count()
      expect(examples).toBeGreaterThan(0)
      for (let index = 0; index < examples; index++) {
        await page.goto('/')
        await page.getByRole('link', { name: 'Try the example plot' }).nth(index).click()
        await expect(page).toHaveURL(/\/app#plot=/)
        await expect(designTable(page)).toBeAttached({ timeout: READY_TIMEOUT })
      }
    })

    test('every question opens on a click and closes on the next', async ({ page }) => {
      const names = await collapsedQuestions(page).allTextContents()
      expect(names.length).toBeGreaterThan(0)
      for (const name of names) {
        const toggle = question(page, name)
        await toggle.scrollIntoViewIfNeeded()
        await toggle.click()
        await expect(toggle).toHaveAttribute('aria-expanded', 'true')
        const answer = page.locator(`[id="${await toggle.getAttribute('aria-controls')}"]`)
        await expect(answer).toBeVisible()
        await toggle.click()
        await expect(toggle).toHaveAttribute('aria-expanded', 'false')
        await expect(answer).toBeHidden()
      }
    })

    test('a question opens and closes from the keyboard', async ({ page }) => {
      const [name] = await collapsedQuestions(page).allTextContents()
      const toggle = question(page, name)
      await toggle.focus()
      await page.keyboard.press('Enter')
      await expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await page.keyboard.press('Space')
      await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })

    test('every image on the page loads', async ({ page }) => {
      await scrollThroughPage(page)
      await expect.poll(() => imagesNotLoaded(page)).toEqual([])
    })

    test('has no serious or critical accessibility violations', async ({ page }) => {
      await scrollThroughPage(page)
      await expect.poll(() => finiteAnimationsRunning(page)).toBe(0)
      await expectNoSeriousViolations(page)
    })
  })
