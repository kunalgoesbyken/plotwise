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
  readonly signal: string
}

const MAPPED_SHADE = 0.25

export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement)
  const read = (name: string) => style.getPropertyValue(`--color-${name}`).trim()
  return {
    paper: read('background'),
    vellum: read('muted'),
    ink: read('foreground'),
    slate: read('muted-foreground'),
    rule: read('border'),
    plot: read('plot'),
    road: read('road'),
    signal: read('destructive'),
  }
}

const toRgb = ({ r, g, b }: Color): Rgb => [r, g, b]

export function buildingTones({ paper, slate }: Palette): BuildingTones {
  return { mapped: toRgb(new Color(paper).lerp(new Color(slate), MAPPED_SHADE)), guessed: toRgb(new Color(paper)) }
}
