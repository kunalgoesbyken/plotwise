import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { feasibility } from '@/feasibility/compute'
import { PlotSchema } from '@/plot/plot'
import { initialEditorState, reduceEditor } from './editor-state'
import { decodePlot, encodePlot } from './plot-url'

const valid = encodePlot({
  ring: [
    [100.5636, 13.7466],
    [100.5646, 13.7466],
    [100.5646, 13.7476],
    [100.5636, 13.7476],
  ],
  roads: [
    { edge: 0, widthM: 16 },
    { edge: 2, widthM: 8.5 },
  ],
  buildingType: 'hotel',
  nearStation: true,
})

const fragments = [
  'plot=', 'roads=', 'type=', 'station=', '&', '&&', ';', ';;', ',', ',,', ':', '=', '#', '%', '%zz', '%20', '+', '-', '.', 'e',
  '0', '1', '2', '3', '-0', '1.5', 'NaN', 'Infinity', '-Infinity', '1e999', '0x10', '1_0', ' ', '๑', '\u0000', '__proto__',
  'condo', 'office', 'hotel', 'castle', '100.5636', '13.7466', '180', '-180', '90', '-90', '9999999999', '1e-9', '1e308',
]

const tokens = fc.array(fc.constantFrom(...fragments), { maxLength: 40 }).map((parts) => parts.join(''))

const mutated = fc
  .record({ at: fc.nat({ max: valid.length }), cut: fc.nat({ max: 12 }), insert: fc.constantFrom('', ...fragments) })
  .map(({ at, cut, insert }) => valid.slice(0, at) + insert + valid.slice(at + cut))

const hashes = fc.oneof(
  { weight: 2, arbitrary: fc.string({ unit: 'binary', maxLength: 120 }) },
  { weight: 3, arbitrary: tokens },
  { weight: 4, arbitrary: mutated },
  { weight: 1, arbitrary: fc.constant(valid) },
)

describe('plot URL fuzz', () => {
  it('never throws and only yields plots that satisfy the schema', () => {
    fc.assert(
      fc.property(hashes, (fragment) => {
        const plot = decodePlot(fragment)
        if (plot) expect(PlotSchema.safeParse(plot).success).toBe(true)
      }),
      { numRuns: 3000 },
    )
  })

  it('opens whatever it decodes without a crash or an unexplained failure', () => {
    fc.assert(
      fc.property(hashes, (fragment) => {
        const plot = decodePlot(fragment)
        if (!plot) return
        const state = reduceEditor(initialEditorState(plot.buildingType), { type: 'load', plot })
        if (!state.plot) return expect(state.notice).not.toBeNull()
        const result = feasibility(state.plot)
        if (result.status === 'failed') expect(result.reason).not.toBe('unknown')
      }),
      { numRuns: 1500 },
    )
  })

  it('reads the fragment its own encoder wrote', () => {
    expect(decodePlot(valid)).not.toBeNull()
  })
})
