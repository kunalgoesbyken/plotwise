import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

const BLOCKING_IMPACTS = ['serious', 'critical']
const STANDARDS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

export async function expectNoSeriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(STANDARDS).analyze()
  const blocking = violations
    .filter(({ impact }) => impact && BLOCKING_IMPACTS.includes(impact))
    .map(({ id, impact, help, nodes }) => `${impact} ${id}: ${help} (${nodes.map((node) => node.target.join(' ')).join(' | ')})`)
  expect(blocking, 'serious or critical accessibility violations').toEqual([])
}
