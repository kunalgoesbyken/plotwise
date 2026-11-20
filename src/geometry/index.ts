export { difference, intersection, shrink } from './clip'
export { GeometryError, type GeometryErrorReason } from './errors'
export { floorPlates, shrinkFloor, type Floor, type FloorPlates, type FootprintLimits } from './floors'
export { minAreaRect, type OrientedRect } from './obb'
export { offsetEdges } from './offset'
export {
  centroid,
  contains,
  edgeLengths,
  normalizeRing,
  polygonArea,
  signedArea,
  totalArea,
  type Loop,
  type Polygon,
  type Ring,
} from './polygon'
export { setbackEnvelope } from './setback'
export { LENGTH_TOLERANCE_M } from './tolerance'
export { tieredEnvelope, type Prism, type Tier } from './volume'
export { dot, length, segmentDistance, subtract } from './vector'
