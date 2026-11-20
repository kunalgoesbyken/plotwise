import { entered, enteredBound } from './cite'
import type { BoundarySetbackRule, RoadSetbackRule } from './setbacks'

export function enteredRoadSetback(distanceM: number, field: string): RoadSetbackRule {
  return {
    appliesAbove: { storeys: enteredBound(0, 'gte', field), heightM: enteredBound(0, 'gte', field) },
    bands: [{ roadWidthM: {}, setback: { kind: 'fromRoadBoundary', distanceM: entered(distanceM, field) } }],
  }
}

export function enteredBoundarySetback(distanceM: number, field: string): BoundarySetbackRule {
  return {
    rule: 'outermostPart',
    scope: 'anyBuilding',
    from: 'plotBoundary',
    bands: [{ heightM: {}, distanceM: entered(distanceM, field) }],
  }
}
