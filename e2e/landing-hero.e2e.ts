import { expect, test, type Page } from '@playwright/test'

const PHONE = { width: 375, height: 812 }

const hero = (page: Page) => page.getByRole('figure')
const video = (page: Page) => hero(page).locator('video')
const isPlaying = (page: Page) => video(page).evaluate((element: HTMLVideoElement) => !element.paused && element.currentTime > 0)
const currentClip = (page: Page) => video(page).evaluate((element: HTMLVideoElement) => element.currentSrc)

test('the hero shows the app moving, muted and looping, and can be paused', async ({ page }) => {
  await page.goto('/')
  await expect(video(page)).toBeAttached()
  await expect(video(page)).toHaveJSProperty('muted', true)
  await expect(video(page)).toHaveJSProperty('loop', true)
  await expect.poll(() => isPlaying(page), { timeout: 15_000 }).toBe(true)
  await expect.poll(() => currentClip(page)).toMatch(/hero-desktop\./)

  await hero(page).getByRole('button', { name: 'Pause the demo' }).click()
  await expect(video(page)).toHaveJSProperty('paused', true)
  await hero(page).getByRole('button', { name: 'Play the demo' }).click()
  await expect.poll(() => isPlaying(page)).toBe(true)
})

test('a phone gets the phone layout of the app, not the shrunken desktop frame', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto('/')
  await expect.poll(() => currentClip(page), { timeout: 15_000 }).toMatch(/hero-phone\./)
  const box = (await hero(page).boundingBox())!
  expect(box.width).toBeLessThanOrEqual(PHONE.width)
  expect(box.height).toBeGreaterThan(box.width)
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the hero is a still picture and loads no video', async ({ page }) => {
    await page.goto('/')
    await expect(hero(page).getByRole('img', { name: /Plotwise showing the example plot/ })).toBeVisible()
    await expect(video(page)).toHaveCount(0)
  })
})

test('the landing page keeps its content in plain sections, not boxed cards', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 2, name: 'From a plot to a first answer' })).toBeVisible()
  await expect(page.locator('article')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'See what a plot can hold before you buy it' })).toHaveCount(1)
})

test('an unknown address shows the branded 404 with a way into the app', async ({ page }) => {
  const response = await page.goto('/no-such-page')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: 'This page is not on the map' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open the app' }).last()).toHaveAttribute('href', '/app')
  await page.getByRole('link', { name: 'Try the example plot' }).click()
  await expect(page).toHaveURL(/\/app#plot=/)
})
