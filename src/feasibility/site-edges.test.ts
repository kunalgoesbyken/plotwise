import { describe, expect, it } from 'bun:test'
import type { Vec2 } from '@/geo/projection'
import { siteOf } from '@/plot/site'
import { plotFromMetres } from '@/solve/test-plots'
import { siteEdgeNames } from './site-edges'

const lShape: Vec2[] = [
  [0, 0],
  [40, 0],
  [40, 20],
  [20, 20],
  [20, 35],
  [0, 35],
]

function names(points: readonly Vec2[]) {
  const plot = plotFromMetres(points, [{ edge: 0, widthM: 10 }])
  const site = siteOf(plot)
  return site.edges.map((edge, i) => ({ name: siteEdgeNames(plot, site)[i], road: edge.roadWidthM }))
}

describe('siteEdgeNames', () => {
  it('names each edge after the drawn corners it joins', () => {
    expect(names(lShape).map((e) => e.name)).toEqual(['A–B', 'B–C', 'C–D', 'D–E', 'E–F', 'F–A'])
  })

  it('keeps the drawn names when the outline was drawn clockwise', () => {
    const edges = names([...lShape].reverse())
    expect(edges.find((e) => e.road === 10)?.name).toBe('A–B')
    expect(edges.map((e) => e.name).sort()).toEqual(['A–B', 'B–C', 'C–D', 'D–E', 'E–F', 'F–A'])
  })

  it('spans a straight-through corner that the engine merged away', () => {
    const edges = names([lShape[0], [25, 0], ...lShape.slice(1)])
    expect(edges).toHaveLength(6)
    expect(edges[0]).toEqual({ name: 'A–C', road: 10 })
  })
})
