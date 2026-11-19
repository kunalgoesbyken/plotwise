export type GeometryErrorReason =
  | 'non-finite'
  | 'out-of-range'
  | 'degenerate'
  | 'self-intersecting'
  | 'invalid-setbacks'
  | 'invalid-tiers'
  | 'invalid-floor-height'
  | 'invalid-cap'

export class GeometryError extends Error {
  readonly reason: GeometryErrorReason

  constructor(reason: GeometryErrorReason, message: string) {
    super(message)
    this.name = 'GeometryError'
    this.reason = reason
  }
}
