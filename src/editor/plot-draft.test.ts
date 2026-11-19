import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import type { LngLat } from '@/geo/projection'
import type { Plot } from '@/plot/plot'
import { MAX_CORNERS, editDraft, emptyDraft, roundLngLat, toPlot, type Draft, type DraftAction } from './plot-draft'

const lShape: Plot['ring'] = [
  [100.53, 13.724],
  [100.532, 13.724],
  [100.532, 13.725],
  [100.531, 13.725],
  [100.531, 13.726],
  [100.53, 13.726],
]

const plot: Plot = { ring: lShape, roads: [{ edge: 0, widthM: 16 }], buildingType: 'condo', nearStation: false }

function apply(draft: Draft, ...actions: DraftAction[]) {
  return actions.reduce((d, action) => {
    const result = editDraft(d, action)
    if (!result.ok) throw new Error(`${action.type} rejected: ${result.reason}`)
    return result.draft
  }, draft)
}

function loaded(p: Plot = plot) {
  return apply(emptyDraft('condo'), { type: 'load', plot: p })
}

function drawn(points: readonly LngLat[]) {
  return apply(emptyDraft('office'), ...points.map((at): DraftAction => ({ type: 'add', at })), { type: 'close' })
}

describe('drawing', () => {
  it('turns clicked points into a closed ring with no roads yet', () => {
    const draft = drawn(lShape)
    expect(draft.status).toBe('closed')
    expect(toPlot(draft)).toBeNull()
    const withRoad = apply(draft, { type: 'mark-road', edge: 2 }, { type: 'set-road-width', edge: 2, widthM: 10 })
    expect(toPlot(withRoad)).toEqual({ ring: lShape, roads: [{ edge: 2, widthM: 10 }], buildingType: 'office', nearStation: false })
  })

  it('refuses a point whose new edge crosses an earlier edge', () => {
    const draft = apply(emptyDraft('condo'), ...lShape.slice(0, 4).map((at): DraftAction => ({ type: 'add', at })))
    expect(editDraft(draft, { type: 'add', at: [100.5315, 13.7235] })).toEqual({ ok: false, reason: 'crossing' })
  })

  it('refuses to close a ring whose closing edge would cross', () => {
    const points: LngLat[] = [
      [0, 0],
      [2, 0],
      [2, 1],
      [0, 1],
      [1, 2],
    ]
    const draft = apply(emptyDraft('condo'), ...points.map((at): DraftAction => ({ type: 'add', at })))
    expect(editDraft(draft, { type: 'close' })).toEqual({ ok: false, reason: 'crossing' })
  })

  it('refuses to close with fewer than 3 corners', () => {
    const draft = apply(emptyDraft('condo'), { type: 'add', at: [0, 0] }, { type: 'add', at: [1, 0] })
    expect(editDraft(draft, { type: 'close' })).toEqual({ ok: false, reason: 'too-few-corners' })
  })

  it('refuses more than the corner limit', () => {
    const points = Array.from({ length: MAX_CORNERS }, (_, i): LngLat => [Math.cos(i / 20), Math.sin(i / 20) + i / 2])
    const draft = apply(emptyDraft('condo'), ...points.map((at): DraftAction => ({ type: 'add', at })))
    expect(editDraft(draft, { type: 'add', at: [50, 60] })).toEqual({ ok: false, reason: 'too-many-corners' })
  })

  it('undoes the last point', () => {
    const draft = apply(emptyDraft('condo'), { type: 'add', at: [0, 0] }, { type: 'add', at: [1, 0] }, { type: 'undo' })
    expect(draft).toEqual({ status: 'drawing', points: [[0, 0]], buildingType: 'condo', nearStation: false })
  })
})

describe('normalizing the outline', () => {
  it('drops a straight-through corner when the outline closes', () => {
    const withCollinear: LngLat[] = [lShape[0], [100.531, 13.724], ...lShape.slice(1)]
    expect(toPlot(apply(drawn(withCollinear), { type: 'mark-road', edge: 0 }, { type: 'set-road-width', edge: 0, widthM: 9 }))).toEqual({
      ring: lShape,
      roads: [{ edge: 0, widthM: 9 }],
      buildingType: 'office',
      nearStation: false,
    })
  })

  it('turns a clockwise outline counter-clockwise so edges match the geometry module', () => {
    const clockwise = [...lShape].reverse()
    const draft = drawn(clockwise)
    expect(draft.status === 'closed' && draft.corners.map((c) => c.at)).toEqual([clockwise[0], ...clockwise.slice(1).reverse()])
  })

  it('remaps roads when a loaded clockwise plot is reversed', () => {
    const clockwise: Plot = { ...plot, ring: [...lShape].reverse(), roads: [{ edge: 0, widthM: 7 }] }
    const result = toPlot(loaded(clockwise))
    expect(result?.ring[0]).toEqual(clockwise.ring[0])
    expect(result?.roads).toEqual([{ edge: 5, widthM: 7 }])
    const [a, b] = [clockwise.ring[0], clockwise.ring[1]]
    expect([result?.ring[5], result?.ring[0]]).toEqual([b, a])
  })

  it('keeps a corner inserted mid-edge until the drag settles, then drops it if it stayed straight', () => {
    const inserted = apply(loaded(), { type: 'insert', edge: 0, at: [100.531, 13.724] })
    expect(toPlot(inserted)?.ring).toHaveLength(7)
    expect(toPlot(apply(inserted, { type: 'settle' }))).toEqual(plot)
  })

  it('reports corners that collapse onto each other', () => {
    const points: LngLat[] = [
      [100.53, 13.724],
      [100.53, 13.724000001],
      [100.530000001, 13.724],
    ]
    const draft = apply(emptyDraft('condo'), ...points.map((at): DraftAction => ({ type: 'add', at })))
    expect(editDraft(draft, { type: 'close' })).toEqual({ ok: false, reason: 'degenerate' })
  })
})

describe('editing a closed plot', () => {
  it('round-trips a plot through load', () => {
    expect(toPlot(loaded())).toEqual(plot)
  })

  it('refuses to load a self-intersecting ring', () => {
    const bowTie: Plot = {
      ...plot,
      ring: [
        [0, 0],
        [1, 1],
        [1, 0],
        [0, 1],
      ],
    }
    expect(editDraft(emptyDraft('condo'), { type: 'load', plot: bowTie })).toEqual({ ok: false, reason: 'crossing' })
  })

  it('moves a corner but refuses a move that makes edges cross', () => {
    const moved = apply(loaded(), { type: 'move', corner: 3, at: [100.5312, 13.7252] })
    expect(toPlot(moved)?.ring[3]).toEqual([100.5312, 13.7252])
    expect(editDraft(loaded(), { type: 'move', corner: 3, at: [100.5305, 13.7235] })).toEqual({
      ok: false,
      reason: 'crossing',
    })
  })

  it('inserting a corner on a road edge keeps both halves as road and shifts later roads', () => {
    const twoRoads: Plot = { ...plot, roads: [{ edge: 0, widthM: 16 }, { edge: 3, widthM: 6 }] }
    const result = toPlot(apply(loaded(twoRoads), { type: 'insert', edge: 0, at: [100.531, 13.724] }))
    expect(result?.ring).toHaveLength(7)
    expect(result?.ring[1]).toEqual([100.531, 13.724])
    expect(result?.roads).toEqual([
      { edge: 0, widthM: 16 },
      { edge: 1, widthM: 16 },
      { edge: 4, widthM: 6 },
    ])
  })

  it('inserting on the closing edge appends a corner', () => {
    const result = toPlot(apply(loaded(), { type: 'insert', edge: 5, at: [100.53, 13.725] }))
    expect(result?.ring[6]).toEqual([100.53, 13.725])
    expect(result?.roads).toEqual([{ edge: 0, widthM: 16 }])
  })

  it('removing a corner merges its two edges and keeps a road on either', () => {
    const roadAfter: Plot = { ...plot, roads: [{ edge: 1, widthM: 12 }] }
    const result = toPlot(apply(loaded(roadAfter), { type: 'remove', corner: 1 }))
    expect(result?.ring).toEqual([lShape[0], ...lShape.slice(2)])
    expect(result?.roads).toEqual([{ edge: 0, widthM: 12 }])
  })

  it('removing corner 0 merges the closing edge with edge 0', () => {
    const pentagon: Plot = {
      ...plot,
      ring: [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 2],
        [-1, 1],
      ],
    }
    const result = toPlot(apply(loaded(pentagon), { type: 'remove', corner: 0 }))
    expect(result?.ring).toEqual(pentagon.ring.slice(1))
    expect(result?.roads).toEqual([{ edge: 3, widthM: 16 }])
  })

  it('refuses to remove a corner from a triangle', () => {
    const triangle: Plot = { ...plot, ring: lShape.slice(0, 3) }
    expect(editDraft(loaded(triangle), { type: 'remove', corner: 0 })).toEqual({ ok: false, reason: 'too-few-corners' })
  })

  it('refuses a removal that would make edges cross', () => {
    expect(editDraft(loaded(), { type: 'remove', corner: 3 }).ok).toBe(true)
    const zigzag: Plot = {
      ...plot,
      ring: [
        [0, 0],
        [4, 0],
        [4, 3],
        [3, 1],
        [2, 3],
        [1, 1],
        [0, 3],
      ],
    }
    expect(editDraft(loaded(zigzag), { type: 'remove', corner: 1 })).toEqual({ ok: false, reason: 'crossing' })
  })

  it('an estimated width fills an empty road and a typed width replaces it', () => {
    const marked = apply(loaded(), { type: 'mark-road', edge: 2 }, { type: 'estimate-road-width', edge: 2, widthM: 9 })
    expect(marked.status === 'closed' && marked.corners[2].edge).toEqual({ road: true, widthM: 9, estimated: true })
    const typed = apply(marked, { type: 'set-road-width', edge: 2, widthM: 10 })
    expect(typed.status === 'closed' && typed.corners[2].edge).toEqual({ road: true, widthM: 10, estimated: false })
    expect(apply(typed, { type: 'estimate-road-width', edge: 2, widthM: 9 })).toBe(typed)
  })

  it('a road without a width keeps the plot incomplete', () => {
    const draft = apply(loaded(), { type: 'mark-road', edge: 2 })
    expect(toPlot(draft)).toBeNull()
    expect(toPlot(apply(draft, { type: 'unmark-road', edge: 2 }))).toEqual(plot)
  })

  it('removing the only road makes the plot incomplete', () => {
    expect(toPlot(apply(loaded(), { type: 'unmark-road', edge: 0 }))).toBeNull()
  })

  it('changes the building type in any state', () => {
    expect(toPlot(apply(loaded(), { type: 'set-building-type', buildingType: 'hotel' }))?.buildingType).toBe('hotel')
    expect(apply(emptyDraft('condo'), { type: 'set-building-type', buildingType: 'office' }).buildingType).toBe('office')
  })

  it('clear keeps the building type', () => {
    expect(apply(loaded(), { type: 'clear' })).toEqual(emptyDraft('condo'))
  })

  it('marks the plot as near a station in any state, and a new outline starts unmarked', () => {
    const near = apply(loaded(), { type: 'set-near-station', nearStation: true })
    expect(toPlot(near)?.nearStation).toBe(true)
    expect(toPlot(apply(near, { type: 'set-near-station', nearStation: false }))).toEqual(plot)
    expect(apply(emptyDraft('condo'), { type: 'set-near-station', nearStation: true }).nearStation).toBe(true)
    expect(apply(near, { type: 'clear' }).nearStation).toBe(false)
  })

  it('loads the station flag with the plot', () => {
    expect(toPlot(loaded({ ...plot, nearStation: true }))?.nearStation).toBe(true)
  })

  it('ignores edits aimed at corners or edges that do not exist', () => {
    const draft = loaded()
    expect(apply(draft, { type: 'move', corner: 99, at: [0, 0] })).toBe(draft)
    expect(apply(draft, { type: 'mark-road', edge: -1 })).toBe(draft)
    expect(apply(draft, { type: 'set-road-width', edge: 3, widthM: 8 })).toBe(draft)
  })

  it('ignores a road width the plot schema would refuse', () => {
    const draft = loaded()
    for (const widthM of [0, -5, Number.NaN, Infinity, 1e12]) {
      expect(apply(draft, { type: 'set-road-width', edge: 0, widthM })).toBe(draft)
      expect(apply(draft, { type: 'mark-road', edge: 1 }, { type: 'set-road-width', edge: 1, widthM }).corners[1].edge).toEqual({
        road: true,
        widthM: null,
        estimated: false,
      })
    }
  })

  it('refuses a corner outside the longitude and latitude range', () => {
    const outside: LngLat[] = [[190, 13.7], [100.5, 91], [Number.NaN, 13.7], [100.5, Infinity]]
    for (const at of outside) {
      expect(editDraft(emptyDraft('condo'), { type: 'add', at })).toEqual({ ok: false, reason: 'out-of-range' })
      expect(editDraft(loaded(), { type: 'move', corner: 1, at })).toEqual({ ok: false, reason: 'out-of-range' })
      expect(editDraft(loaded(), { type: 'insert', edge: 1, at })).toEqual({ ok: false, reason: 'out-of-range' })
    }
    const wrapped: Plot = { ...plot, ring: plot.ring.map(([lng, lat]): LngLat => [lng + 180, lat]) }
    expect(editDraft(emptyDraft('condo'), { type: 'load', plot: wrapped })).toEqual({ ok: false, reason: 'out-of-range' })
  })
})

describe('roundLngLat', () => {
  it('keeps 7 decimals so a coordinate survives a decimal round trip', () => {
    fc.assert(
      fc.property(fc.double({ min: -180, max: 180, noNaN: true }), fc.double({ min: -90, max: 90, noNaN: true }), (lng, lat) => {
        const [x, y] = roundLngLat([lng, lat])
        expect(Math.abs(x - lng)).toBeLessThanOrEqual(5e-8)
        expect(Math.abs(y - lat)).toBeLessThanOrEqual(5e-8)
        expect(Number(String(x))).toBe(x)
        expect(String(x).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(7)
      }),
    )
  })
})
