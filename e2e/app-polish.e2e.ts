import { expect, test, type Page } from '@playwright/test'
import { mockSite, mockZoneInside, openExample } from './app-fixtures'

const PHONE = { width: 375, height: 812 }

const LIBRARY_NOTICES = ['GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels', 'THREE.Clock: This module has been deprecated']

const stepper = (page: Page, step: 'Plot' | 'Roads' | 'Results') => page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: step })
const sheet = (page: Page) => page.locator('.thin-scroll')
const sheetTop = (page: Page) => sheet(page).evaluate((element) => element.scrollTop)

function collectConsoleProblems(page: Page) {
  const problems: string[] = []
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    const text = message.text()
    if (['error', 'warning'].includes(message.type()) && !LIBRARY_NOTICES.some((notice) => text.includes(notice))) problems.push(`${message.type()}: ${text}`)
  })
  return problems
}

test('the results sheet opens at the top on a phone and again after a scrolled step', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await openExample(page)
  expect(await sheetTop(page)).toBe(0)
  await expect(page.getByRole('heading', { name: 'Building type' })).toBeInViewport()
  await expect(page.getByText('You can build up to')).toBeInViewport()

  await stepper(page, 'Roads').click()
  await sheet(page).evaluate((element) => element.scrollTo({ top: element.scrollHeight }))
  expect(await sheetTop(page)).toBeGreaterThan(0)
  await stepper(page, 'Results').click()
  await expect.poll(() => sheetTop(page)).toBe(0)
  await expect(page.getByRole('heading', { name: 'Building type' })).toBeInViewport()
})

test('asks for the surrounding site once on a desktop', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => request.url().includes('/api/site') && requests.push(request.url()))
  await openExample(page)
  await expect(page.locator('[data-scene-buildings]')).toBeAttached()
  await page.waitForTimeout(500)
  expect(requests).toHaveLength(1)
})

test('asks for the surrounding site once on a phone, also after opening the 3D tab', async ({ page }) => {
  await page.setViewportSize(PHONE)
  const requests: string[] = []
  page.on('request', (request) => request.url().includes('/api/site') && requests.push(request.url()))
  await openExample(page)
  await page.getByRole('tab', { name: '3D', exact: true }).click()
  await expect(page.locator('[data-scene-buildings]')).toBeAttached()
  await page.waitForTimeout(500)
  expect(requests).toHaveLength(1)
})

test('keeps the console free of errors and warnings from the app and the map style', async ({ page }) => {
  const problems = collectConsoleProblems(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await mockSite(page)
  await mockZoneInside(page)
  await page.goto('/app')
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Try an example plot' }).click()
  await stepper(page, 'Results').click()
  await expect(page.getByRole('table', { name: 'Designs compared', includeHidden: true })).toBeAttached({ timeout: 30_000 })
  await expect(page.locator('[data-scene-ready="true"]')).toBeAttached({ timeout: 30_000 })
  for (const tab of ['Money', 'Rules', 'Designs']) await page.getByRole('tab', { name: tab, exact: true }).click()
  await page.waitForTimeout(1_000)
  expect(problems).toEqual([])
})

test('Copy link confirms that the link was copied and puts it on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openExample(page)
  await page.getByRole('button', { name: 'Copy link' }).click()
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toBeAttached()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url())
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
})

test('Copy link says what to do when the clipboard is not available', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined }))
  await openExample(page)
  await page.getByRole('button', { name: 'Copy link' }).click()
  await expect(page.getByRole('button', { name: 'Copy the address bar' })).toBeVisible()
})

test('the print summary is one clean page with the figures and the link', async ({ page }) => {
  await openExample(page)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { level: 1, name: /plot summary/ })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Steps' })).toBeHidden()
  await expect(page.getByRole('term').filter({ hasText: 'Floor area' })).toBeVisible()
  const pdf = await page.pdf({ format: 'A4', printBackground: true })
  const pages = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []
  expect(pages).toHaveLength(1)
})
