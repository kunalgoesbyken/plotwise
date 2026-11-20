import { expect, test, type Page, type Route } from '@playwright/test'
import type { Place } from '../src/geocode/schema'

const ASOK: Place = { id: 'N1', label: 'Asok, Watthana, Bangkok', lngLat: [100.5604, 13.7372], kind: 'locality' }
const NANA: Place = { id: 'N2', label: 'Nana, Khlong Toei, Bangkok', lngLat: [100.5535, 13.7406], kind: 'locality' }

const RESPONSE_DELAY_MS = 1_200

const answerFor = (query: string, route: Route) => {
  if (query === 'sukhumvit') return route.fulfill({ json: [ASOK, NANA] })
  if (query === 'slow') return new Promise((resolve) => setTimeout(resolve, RESPONSE_DELAY_MS)).then(() => route.fulfill({ json: [ASOK] }))
  if (query === 'nowhere') return route.fulfill({ json: [] })
  return route.fulfill({ status: 502, json: { error: 'down' } })
}

async function openSearch(page: Page) {
  await page.route('**/api/geocode?**', (route) => answerFor(new URL(route.request().url()).searchParams.get('q')!, route))
  await page.goto('/app')
  return page.getByRole('combobox', { name: 'Search for an address or place in Thailand' })
}

const places = (page: Page) => page.getByRole('listbox', { name: 'Places found' })

test('lists the places found and picks one with the pointer', async ({ page }) => {
  const search = await openSearch(page)
  await search.fill('sukhumvit')
  await expect(places(page).getByRole('option')).toHaveText([ASOK.label, NANA.label])
  await places(page).getByRole('option', { name: NANA.label }).click()
  await expect(search).toHaveValue(NANA.label)
  await expect(places(page)).toBeHidden()
})

test('moves through the places with the arrow keys, picks with Enter and closes with Escape', async ({ page }) => {
  const search = await openSearch(page)
  await search.fill('sukhumvit')
  const options = places(page).getByRole('option')
  await expect(options).toHaveCount(2)
  await expect(options.first()).toHaveAttribute('aria-selected', 'true')
  await search.press('ArrowDown')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  await search.press('ArrowDown')
  await expect(options.first()).toHaveAttribute('aria-selected', 'true')
  await search.press('ArrowUp')
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
  await search.press('Enter')
  await expect(search).toHaveValue(NANA.label)
  await expect(places(page)).toBeHidden()

  await search.fill('sukhumvit')
  await expect(options).toHaveCount(2)
  await search.press('Escape')
  await expect(places(page)).toBeHidden()
})

test('says so when no place matches', async ({ page }) => {
  const search = await openSearch(page)
  await search.fill('nowhere')
  await expect(page.getByText('No places found. Try a soi, building or district')).toBeVisible()
  await expect(places(page)).toBeHidden()
})

test('shows that it is searching while the answer is on its way', async ({ page }) => {
  const search = await openSearch(page)
  await search.fill('slow')
  await expect(page.getByText('Searching…')).toBeVisible()
  await expect(places(page).getByRole('option')).toHaveText([ASOK.label])
  await expect(page.getByText('Searching…')).toBeHidden()
})

test('says when place search is down', async ({ page }) => {
  const search = await openSearch(page)
  await search.fill('boom')
  await expect(page.getByText('Place search is unavailable right now. Pan the map to the site instead.')).toBeVisible()
  await expect(places(page)).toBeHidden()
})
