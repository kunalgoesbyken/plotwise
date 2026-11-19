export type Rect = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }
export type Padding = { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number }

type Side = keyof Padding

function overlap(frame: Rect, cover: Rect): Rect | null {
  const left = Math.max(cover.left, frame.left)
  const right = Math.min(cover.right, frame.right)
  const top = Math.max(cover.top, frame.top)
  const bottom = Math.min(cover.bottom, frame.bottom)
  return right > left && bottom > top ? { left, top, right, bottom } : null
}

function openArea(frame: Rect, { top, bottom, left, right }: Padding): number {
  return Math.max(0, frame.right - frame.left - left - right) * Math.max(0, frame.bottom - frame.top - top - bottom)
}

function clearOf(frame: Rect, covered: Rect, padding: Padding, margin: Padding): Padding {
  const depth: Record<Side, number> = {
    left: covered.right - frame.left,
    right: frame.right - covered.left,
    top: covered.bottom - frame.top,
    bottom: frame.bottom - covered.top,
  }
  const options = (Object.keys(depth) as Side[]).map((side) => ({ ...padding, [side]: Math.max(padding[side], depth[side] + margin[side]) }))
  return options.reduce((best, option) => (openArea(frame, option) > openArea(frame, best) ? option : best))
}

export function insideClearArea(points: readonly { x: number; y: number }[], width: number, height: number, padding: Padding): boolean {
  return points.every(
    ({ x, y }) => x >= padding.left && x <= width - padding.right && y >= padding.top && y <= height - padding.bottom,
  )
}

export function fitPadding(frame: Rect, covers: readonly Rect[], margin: Padding): Padding {
  return covers.reduce((padding, cover) => {
    const covered = overlap(frame, cover)
    return covered ? clearOf(frame, covered, padding, margin) : padding
  }, margin)
}
