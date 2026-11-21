import { z } from 'zod'
import { CiteSchema, entered, enteredBound, enteredCite } from './cite'
import type { OpenSpaceMinimumRule } from './open-space'
import type { ParkingDemand, ParkingRule } from './parking'
import type { BoundarySetbackRule, RoadSetbackRule } from './setbacks'

export const PlotSpecificSchema = z.object({ kind: z.literal('plotSpecific'), notes: z.array(CiteSchema) })

export const PlotSetbacksSchema = PlotSpecificSchema.extend({ edges: z.enum(['roadAndBoundary', 'boundary']) })

export function enteredRoadSetback(distanceM: number, field: string): RoadSetbackRule {
  return {
    appliesAbove: { storeys: enteredBound(0, 'gte', field) },
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

export function enteredOpenSpace(share: number, field: string): OpenSpaceMinimumRule[] {
  return (['residential', 'nonResidential'] as const).map((use) => ({ use, scope: 'anyBuilding', base: 'landArea', minShare: entered(share, field) }))
}

export function enteredParking(sqmPerSpace: number, field: string): ParkingRule {
  const demand: ParkingDemand = { kind: 'perGrossArea', sqmPerSpace: entered(sqmPerSpace, field) }
  return { scope: 'entered', appliesWhere: enteredCite(field), condo: demand, office: demand, hotel: demand }
}

export function enteredParkingPerHome(spacesPerHome: number, field: string): ParkingRule {
  const demand: ParkingDemand = { kind: 'perUnit', spacesPerUnit: entered(spacesPerHome, field), unitsFromSqm: enteredBound(0, 'gte', field) }
  return { scope: 'entered', appliesWhere: enteredCite(field), condo: demand }
}
