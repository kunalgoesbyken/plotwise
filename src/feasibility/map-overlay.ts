import type { LocalFrame } from '@/geo/projection'
import type { Loop, Polygon } from '@/geometry'
import type { MapOverlay, OverlayKind } from '@/editor/map-layers'

const closedRing = (frame: LocalFrame, loop: Loop) => [...loop, loop[0]].map((point) => [...frame.toLngLat(point)])

function feature(frame: LocalFrame, kind: OverlayKind, polygons: readonly Polygon[]): MapOverlay['features'][number] {
  return {
    type: 'Feature',
    geometry: { type: 'MultiPolygon', coordinates: polygons.map((p) => [p.outer, ...p.holes].map((loop) => closedRing(frame, loop))) },
    properties: { kind },
  }
}

export function mapOverlay(frame: LocalFrame, envelope: readonly Polygon[], building: readonly Polygon[]): MapOverlay {
  return { type: 'FeatureCollection', features: [feature(frame, 'envelope', envelope), feature(frame, 'building', building)] }
}
