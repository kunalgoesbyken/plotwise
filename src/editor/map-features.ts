import type { LngLat } from '@/geo/projection'
import type { EditorState, Selection } from './editor-state'
import type { Draft } from './plot-draft'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export type MapLabel = { id: string; kind: 'corner' | 'road'; at: LngLat; text: string }

type Feature = GeoJSON.Feature<GeoJSON.Geometry, Record<string, string | number | boolean>>

export function cornerName(index: number): string {
  const letter = ALPHABET[index % ALPHABET.length]
  return index < ALPHABET.length ? letter : cornerName(Math.floor(index / ALPHABET.length) - 1) + letter
}

export function edgeName(edge: number, cornerCount: number) {
  return `${cornerName(edge)}–${cornerName((edge + 1) % cornerCount)}`
}

function formatMetres(widthM: number | null) {
  return `${widthM ?? '?'} m`
}

function midpoint(a: LngLat, b: LngLat): LngLat {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

function vertices(draft: Draft): readonly LngLat[] {
  return draft.status === 'drawing' ? draft.points : draft.corners.map((c) => c.at)
}

function isSelected(selection: Selection, kind: Selection['kind'], index: number) {
  return selection.kind === kind && 'index' in selection && selection.index === index
}

const point = (at: LngLat, properties: Feature['properties']): Feature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [...at] },
  properties,
})

const line = (a: LngLat, b: LngLat, properties: Feature['properties']): Feature => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: [[...a], [...b]] },
  properties,
})

export function mapFeatures({ draft, selection }: Pick<EditorState, 'draft' | 'selection'>): GeoJSON.FeatureCollection {
  const at = vertices(draft)
  const closed = draft.status === 'closed'
  const edgeCount = closed ? at.length : Math.max(at.length - 1, 0)
  const ends = (i: number) => [at[i], at[(i + 1) % at.length]] as const
  const road = (i: number) => closed && draft.corners[i].edge.road

  const area: Feature[] = closed
    ? [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...at, at[0]].map((p) => [...p])] }, properties: { kind: 'area' } }]
    : []
  const edges = Array.from({ length: edgeCount }, (_, i) =>
    line(...ends(i), { kind: 'edge', index: i, road: road(i), selected: isSelected(selection, 'edge', i) }),
  )
  const midpoints = closed ? Array.from({ length: edgeCount }, (_, i) => point(midpoint(...ends(i)), { kind: 'midpoint', edge: i })) : []
  const corners = at.map((p, i) =>
    point(p, {
      kind: 'corner',
      index: i,
      closable: !closed && i === 0 && at.length >= 3,
      selected: isSelected(selection, 'corner', i),
    }),
  )
  return { type: 'FeatureCollection', features: [...area, ...edges, ...midpoints, ...corners] }
}

export function mapLabels(draft: Draft): MapLabel[] {
  const at = vertices(draft)
  const corners = at.map((p, i): MapLabel => ({ id: `corner-${i}`, kind: 'corner', at: p, text: cornerName(i) }))
  if (draft.status === 'drawing') return corners
  const roads = draft.corners.flatMap(({ edge }, i): MapLabel[] =>
    edge.road
      ? [{ id: `road-${i}`, kind: 'road', at: midpoint(at[i], at[(i + 1) % at.length]), text: formatMetres(edge.widthM) }]
      : [],
  )
  return [...corners, ...roads]
}
