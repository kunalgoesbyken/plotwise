import { describe, expect, it } from 'bun:test'
import { irregularPlot } from './arbitraries'
import { floorPlates } from './floors'
import { normalizeRing } from './polygon'
import { tieredEnvelope } from './volume'

const RUNS = 60

function medianMs(run: () => void): number {
  for (let i = 0; i < 10; i++) run()
  const times = Array.from({ length: RUNS }, () => {
    const start = performance.now()
    run()
    return performance.now() - start
  }).sort((a, b) => a - b)
  return times[Math.floor(RUNS / 2)]
}

describe('performance', () => {
  it('builds the envelope and floor plates of a 30-vertex plot in under 5 ms', () => {
    const plot = normalizeRing(irregularPlot(30))
    const setbacks = plot.map((_, i) => 1 + (i % 6))
    const ms = medianMs(() => floorPlates(tieredEnvelope(plot, [{ fromM: 0, toM: 60, setbacks }]), 3.2))
    console.log(`30-vertex envelope + floor plates: median ${ms.toFixed(2)} ms`)
    expect(ms).toBeLessThan(5)
  })
})
