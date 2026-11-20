import { expect, test as base, type ConsoleMessage } from '@playwright/test'

const REPORTED_TYPES: readonly string[] = ['error', 'warning']

const MASKS: readonly (readonly [RegExp, string])[] = [
  [/0x[0-9a-f]+/gi, '0x#'],
  [/https?:\/\/[^\s/]+/g, '<origin>'],
  [/chunks\/[\w-]+\.css/g, 'chunks/#.css'],
]

export const stable = (text: string) => MASKS.reduce((masked, [pattern, replacement]) => masked.replace(pattern, replacement), text)

const BASELINE_NOISE: readonly string[] = [
  '[.WebGL-0x#]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels',
  '[.WebGL-0x#]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (this message will no longer repeat)',
  'layers[highway-shield-non-us].filter[1]: Expected value to be of type number, but found null instead. Falling back to false.',
  'layers[highway-shield-us-interstate].filter[1]: Expected value to be of type number, but found null instead. Falling back to false.',
  'layers[road_shield_us].filter[1]: Expected value to be of type number, but found null instead. Falling back to false.',
  'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.',
]

type Options = { allowedConsoleMessages: readonly string[] }

function isFromOurOrigin(message: ConsoleMessage, origin: string) {
  const { url } = message.location()
  return url !== '' && new URL(url).origin === origin
}

export const test = base.extend<Options & { consoleProblems: void }>({
  allowedConsoleMessages: [[], { option: true }],
  consoleProblems: [
    async ({ page, baseURL, allowedConsoleMessages }, use) => {
      const origin = new URL(baseURL!).origin
      const allowed = new Set([...BASELINE_NOISE, ...allowedConsoleMessages].map(stable))
      const problems: string[] = []
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`))
      page.on('console', (message) => {
        if (!REPORTED_TYPES.includes(message.type()) || !isFromOurOrigin(message, origin)) return
        if (allowed.has(stable(message.text()))) return
        problems.push(`${message.type()}: ${message.text()}`)
      })
      await use()
      expect(problems, 'console errors and warnings from the app').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }
