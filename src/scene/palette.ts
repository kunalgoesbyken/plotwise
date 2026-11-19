import { Color } from 'three'
import type { BuildingTones, Rgb } from './meshes'

export type Palette = {
  readonly paper: string
  readonly vellum: string
  readonly ink: string
  readonly slate: string
  readonly rule: string
  readonly plot: string
  readonly road: string
}

const MAPPED_SHADE = 0.25

export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string) => style.getPropertyValue(`--color-${name}`).trim()
  return {
    paper: read('paper'),
    vellum: read('vellum'),
    ink: read('ink'),
    slate: read('slate'),
    rule: read('rule'),
    plot: read('plot'),
    road: read('road'),
  }
}

const toRgb = ({ r, g, b }: Color): Rgb => [r, g, b]

export function buildingTones({ paper, slate }: Palette): BuildingTones {
  return { mapped: toRgb(new Color(paper).lerp(new Color(slate), MAPPED_SHADE)), guessed: toRgb(new Color(paper)) }
}
