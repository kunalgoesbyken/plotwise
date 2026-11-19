import type { Limits, OpenSpaceMinimum, Sourced } from './limits'

export type OpenSpaceNeed = {
  readonly landSqm: number
  readonly farSqm: number
  readonly largestFloorSqm: number
  readonly highRiseOrExtraLarge: boolean
}

const applies = (minimum: OpenSpaceMinimum, highRiseOrExtraLarge: boolean) =>
  minimum.scope === 'anyBuilding' || highRiseOrExtraLarge

const largest = (needs: readonly Sourced[]): Sourced =>
  needs.reduce((best, need) => (need.value > best.value ? need : best), { value: 0, cites: [] })

export function buildingControlOpenSpace(limits: Limits, need: OpenSpaceNeed): Sourced {
  return largest(
    limits.openSpace.minimums
      .filter((m) => applies(m, need.highRiseOrExtraLarge))
      .map((m) => ({ value: m.share * (m.base === 'landArea' ? need.landSqm : need.largestFloorSqm), cites: m.cites })),
  )
}

export function ratioOpenSpace(limits: Limits, farSqm: number): Sourced {
  return { value: limits.openSpace.ratio.value * farSqm, cites: limits.openSpace.ratio.cites }
}

export function permeableArea(limits: Limits, need: OpenSpaceNeed, openSpaceSqm: number): Sourced {
  const { permeable } = limits.openSpace
  const base = permeable.base === 'required' ? ratioOpenSpace(limits, need.farSqm).value : openSpaceSqm
  return { value: permeable.value * base, cites: permeable.cites }
}

export function footprintCapSqm(limits: Limits, need: Omit<OpenSpaceNeed, 'largestFloorSqm'>): number {
  const { landSqm } = need
  const caps = limits.openSpace.minimums
    .filter((m) => applies(m, need.highRiseOrExtraLarge))
    .map((m) => (m.base === 'landArea' ? landSqm * (1 - m.share) : landSqm / (1 + m.share)))
  return Math.max(0, Math.min(landSqm - ratioOpenSpace(limits, need.farSqm).value, ...caps))
}
