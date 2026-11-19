import type { LngLat } from '@/geo/projection'

export type Ring = LngLat[]
export type RingGroup = { outer: Ring; holes: Ring[] }

const MIN_RING_POINTS = 3

function key([lng, lat]: LngLat): string {
  return `${lng},${lat}`
}

function sameLngLat(a: LngLat, b: LngLat): boolean {
  return a[0] === b[0] && a[1] === b[1]
}

export function isClosed(line: LngLat[]): boolean {
  return line.length > 1 && sameLngLat(line[0], line[line.length - 1])
}

export function signedArea(ring: Ring): number {
  let twice = 0
  ring.forEach(([x1, y1], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length]
    twice += x1 * y2 - x2 * y1
  })
  return twice / 2
}

export function orient(ring: Ring, direction: 'ccw' | 'cw'): Ring {
  const isCcw = signedArea(ring) > 0
  return isCcw === (direction === 'ccw') ? ring : [...ring].reverse()
}

export function pointInRing([x, y]: LngLat, ring: Ring): boolean {
  let inside = false
  ring.forEach(([x1, y1], i) => {
    const [x2, y2] = ring[(i + 1) % ring.length]
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside
  })
  return inside
}

export function toOpenRing(line: LngLat[]): Ring | undefined {
  if (!isClosed(line)) return undefined
  const ring = line.slice(0, -1)
  const distinct = new Set(ring.map(key)).size
  return distinct >= MIN_RING_POINTS ? ring : undefined
}

function extend(chain: LngLat[], candidates: LngLat[][]): boolean {
  const tail = chain[chain.length - 1]
  const index = candidates.findIndex((line) => sameLngLat(line[0], tail) || sameLngLat(line[line.length - 1], tail))
  if (index === -1) return false
  const [line] = candidates.splice(index, 1)
  const oriented = sameLngLat(line[0], tail) ? line : [...line].reverse()
  chain.push(...oriented.slice(1))
  return true
}

export function assembleRings(lines: LngLat[][]): Ring[] {
  const pending = lines.filter((line) => line.length > 1)
  const rings: Ring[] = []
  while (pending.length > 0) {
    const chain = [...pending.shift()!]
    let extended = true
    while (extended && !isClosed(chain)) extended = extend(chain, pending)
    const ring = toOpenRing(chain)
    if (ring) rings.push(ring)
  }
  return rings
}

function containsRing(outer: Ring, inner: Ring): boolean {
  return inner.some((point) => pointInRing(point, outer))
}

export function groupHoles(outers: Ring[], inners: Ring[]): RingGroup[] {
  const oriented = outers.map((outer) => orient(outer, 'ccw'))
  const groups = oriented.map((outer): RingGroup => ({ outer, holes: [] }))
  const bySmallestArea = [...groups].sort((a, b) => signedArea(a.outer) - signedArea(b.outer))
  inners.forEach((inner) => {
    const owner = bySmallestArea.find((group) => containsRing(group.outer, inner))
    owner?.holes.push(orient(inner, 'cw'))
  })
  return groups
}
