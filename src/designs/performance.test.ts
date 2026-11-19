import { describe, expect, it } from 'bun:test'
import type { Vec2 } from '@/geo/projection'
import { irregularPlot } from '@/geometry/arbitraries'
import { BUILDING_TYPES } from '@/plot/plot'
import { loadPack } from '@/rules'
import { packInterpretations, solve } from '@/solve'
import { plotFromMetres } from '@/solve/test-plots'
import { designs } from './designs'

const RUNS = 40

function medianMs(run: () => void): number {
  for (let i = 0; i < 5; i++) run()
  const times = Array.from({ length: RUNS }, () => {
    const start = performance.now()
    run()
    return performance.now() - start
  }).sort((a, b) => a - b)
  return times[Math.floor(RUNS / 2)]
}

describe('performance', () => {
  const pack = loadPack('bkk-y9')
  const readings = packInterpretations(pack)
  const roads = [
    { edge: 0, widthM: 16 },
    { edge: 8, widthM: 8 },
  ]

  const plots = {
    'soi-sized': irregularPlot(30),
    'high-rise-sized': irregularPlot(30).map(([x, y]): Vec2 => [2 * x, 2 * y]),
  }

  for (const [size, points] of Object.entries(plots)) {
    for (const type of BUILDING_TYPES) {
      it(`solves a ${size} 30-vertex ${type} plot and designs it in under 30 ms`, () => {
        const plot = plotFromMetres(points, roads, type)
        const solution = solve(plot, pack, readings)
        expect(solution.envelopes.length).toBe(size === 'high-rise-sized' ? 2 : 1)
        const ms = medianMs(() => designs(solve(plot, pack, readings)))
        console.log(`${size} 30-vertex ${type} solve + designs: median ${ms.toFixed(2)} ms`)
        expect(ms).toBeLessThan(30)
      })
    }
  }
})
