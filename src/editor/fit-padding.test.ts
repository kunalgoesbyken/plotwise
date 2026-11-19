import { describe, expect, it } from 'bun:test'
import { fitPadding, insideClearArea } from './fit-padding'

const frame = { left: 0, top: 0, right: 1280, bottom: 800 }
const margin = { top: 96, bottom: 48, left: 48, right: 48 }

describe('fitPadding', () => {
  it('keeps the plot clear of a side panel and of a floating inset in the bottom-left corner', () => {
    const panel = { left: 872, top: 12, right: 1268, bottom: 788 }
    const inset = { left: 12, top: 468, right: 492, bottom: 788 }
    expect(fitPadding(frame, [panel, inset], margin)).toEqual({ top: 96, bottom: 380, left: 48, right: 456 })
  })

  it('pads the bottom for a phone bottom sheet', () => {
    const phone = { left: 0, top: 0, right: 375, bottom: 812 }
    const sheet = { left: 0, top: 341, right: 375, bottom: 812 }
    expect(fitPadding(phone, [sheet], margin)).toEqual({ ...margin, bottom: 471 + 48 })
  })

  it('ignores covers that are hidden or outside the map', () => {
    const hidden = { left: 0, top: 0, right: 0, bottom: 0 }
    const outside = { left: 1300, top: 0, right: 1400, bottom: 800 }
    expect(fitPadding(frame, [hidden, outside], margin)).toEqual(margin)
  })
})

describe('insideClearArea', () => {
  const padding = { top: 96, bottom: 380, left: 48, right: 456 }

  it('accepts a plot whose corners all sit in the uncovered part of the map', () => {
    expect(insideClearArea([{ x: 100, y: 120 }, { x: 700, y: 400 }], 1280, 800, padding)).toBe(true)
  })

  it('rejects a plot with a corner under the panel, the inset or off screen', () => {
    expect(insideClearArea([{ x: 100, y: 120 }, { x: 900, y: 200 }], 1280, 800, padding)).toBe(false)
    expect(insideClearArea([{ x: 100, y: 120 }, { x: 300, y: 600 }], 1280, 800, padding)).toBe(false)
    expect(insideClearArea([{ x: -20, y: 120 }], 1280, 800, padding)).toBe(false)
  })
})
