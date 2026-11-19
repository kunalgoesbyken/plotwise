import type { Vec2 } from '@/geo/projection'
import { signedArea } from '@/geometry'
import { cornerName } from '@/editor/map-features'
import type { Plot } from '@/plot/plot'
import type { Site } from '@/plot/site'

function nearestCorner(corners: readonly Vec2[], [x, y]: Vec2): number {
  return corners.reduce((best, [cx, cy], i) => {
    const [bx, by] = corners[best]
    return Math.hypot(cx - x, cy - y) < Math.hypot(bx - x, by - y) ? i : best
  }, 0)
}

export function siteEdgeNames(plot: Plot, site: Site): string[] {
  const corners = plot.ring.map(site.frame.toLocal)
  const forward = signedArea(corners) > 0
  const index = site.ring.map((point) => nearestCorner(corners, point))
  return index.map((from, i) => {
    const to = index[(i + 1) % index.length]
    const [first, last] = forward ? [from, to] : [to, from]
    return `${cornerName(first)}–${cornerName(last)}`
  })
}
