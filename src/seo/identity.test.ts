import { describe, expect, it } from 'bun:test'
import { SHARE_PALETTE } from './identity'

const tokens = await Bun.file(`${import.meta.dir}/../app/globals.css`).text()

const tokenOf = (name: string) => new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`).exec(tokens)?.[1]

describe('SHARE_PALETTE', () => {
  it.each([
    ['canvas', 'canvas'],
    ['card', 'background'],
    ['border', 'border'],
    ['ink', 'foreground'],
    ['muted', 'muted-foreground'],
    ['plot', 'plot'],
    ['road', 'road'],
  ] as const)('%s matches the design token --color-%s', (colour, token) => {
    expect(SHARE_PALETTE.value[colour]).toBe(tokenOf(token)!)
  })
})
