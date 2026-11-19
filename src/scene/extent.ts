import type { Vec2 } from '@/geo/projection'

export type Extent = readonly [minX: number, minY: number, maxX: number, maxY: number]

export function extentOf(points: readonly Vec2[]): Extent {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

export function extentsMeet([aMinX, aMinY, aMaxX, aMaxY]: Extent, [bMinX, bMinY, bMaxX, bMaxY]: Extent): boolean {
  return aMinX <= bMaxX && bMinX <= aMaxX && aMinY <= bMaxY && bMinY <= aMaxY
}
