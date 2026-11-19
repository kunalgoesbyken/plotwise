export type LngLat = readonly [lng: number, lat: number]
export type Vec2 = readonly [x: number, y: number]

export type LocalFrame = {
  origin: LngLat
  toLocal: (p: LngLat) => Vec2
  toLngLat: (v: Vec2) => LngLat
}

const EARTH_RADIUS_M = 6_371_008.8
const RAD = Math.PI / 180

export function localFrame(origin: LngLat): LocalFrame {
  const metresPerDegLat = EARTH_RADIUS_M * RAD
  const metresPerDegLng = metresPerDegLat * Math.cos(origin[1] * RAD)
  return {
    origin,
    toLocal: ([lng, lat]) => [(lng - origin[0]) * metresPerDegLng, (lat - origin[1]) * metresPerDegLat],
    toLngLat: ([x, y]) => [origin[0] + x / metresPerDegLng, origin[1] + y / metresPerDegLat],
  }
}
