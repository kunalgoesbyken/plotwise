import { z } from 'zod'
import { localFrame, type LngLat } from '@/geo/projection'
import { MAX_BBOX_SIDE_M, SITE_MARGIN_M, SNAP_CELLS_PER_DEGREE, THAILAND_BBOX } from './assumptions'

export type Bbox = readonly [minLng: number, minLat: number, maxLng: number, maxLat: number]

const MALFORMED = 'bbox must be four numbers: minLng,minLat,maxLng,maxLat'

const Coordinate = z.number({ error: MALFORMED })

const OrderedBboxSchema = z
  .tuple([Coordinate, Coordinate, Coordinate, Coordinate], { error: MALFORMED })
  .readonly()
  .refine(([minLng, minLat, maxLng, maxLat]) => minLng < maxLng && minLat < maxLat, {
    error: 'bbox minimums must be below maximums',
    abort: true,
  })

export function snapBbox([minLng, minLat, maxLng, maxLat]: Bbox): Bbox {
  const cells = SNAP_CELLS_PER_DEGREE.value
  return [
    Math.floor(minLng * cells) / cells,
    Math.floor(minLat * cells) / cells,
    Math.ceil(maxLng * cells) / cells,
    Math.ceil(maxLat * cells) / cells,
  ]
}

export function bboxSideLengthsM([minLng, minLat, maxLng, maxLat]: Bbox): { widthM: number; heightM: number } {
  const [x, y] = localFrame([minLng, minLat]).toLocal([maxLng, maxLat])
  return { widthM: x, heightM: y }
}

function isInsideThailand([minLng, minLat, maxLng, maxLat]: Bbox): boolean {
  const [westLimit, southLimit, eastLimit, northLimit] = THAILAND_BBOX.value
  return minLng >= westLimit && minLat >= southLimit && maxLng <= eastLimit && maxLat <= northLimit
}

function isSmallEnough(bbox: Bbox): boolean {
  const { widthM, heightM } = bboxSideLengthsM(bbox)
  return Math.max(widthM, heightM) <= MAX_BBOX_SIDE_M.value
}

const LimitedBboxSchema = z
  .custom<Bbox>()
  .refine(isInsideThailand, { error: 'bbox must lie inside Thailand', abort: true })
  .refine(isSmallEnough, {
    error: `bbox is too large: after snapping, each side must be at most ${MAX_BBOX_SIDE_M.value} m`,
  })

function splitCoordinates(param: string): readonly number[] {
  return param.split(',').map((part) => (part.trim() === '' ? NaN : Number(part)))
}

export const BboxSchema = OrderedBboxSchema.pipe(LimitedBboxSchema)

export const BboxParamSchema = z
  .string({ error: 'bbox is required: minLng,minLat,maxLng,maxLat' })
  .transform(splitCoordinates)
  .pipe(OrderedBboxSchema)
  .transform(snapBbox)
  .pipe(LimitedBboxSchema)

export function bboxQuery(bbox: Bbox): string {
  return bbox.join(',')
}

export function expandBbox([minLng, minLat, maxLng, maxLat]: Bbox, marginM: number): Bbox {
  const frame = localFrame([minLng, minLat])
  const [width, height] = frame.toLocal([maxLng, maxLat])
  return [...frame.toLngLat([-marginM, -marginM]), ...frame.toLngLat([width + marginM, height + marginM])]
}

export function plotSiteBbox(ring: readonly LngLat[]): Bbox {
  const lngs = ring.map(([lng]) => lng)
  const lats = ring.map(([, lat]) => lat)
  return expandBbox([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], SITE_MARGIN_M.value)
}
