export const AREA_UNITS = ['sqm', 'sqft'] as const
export type AreaUnit = (typeof AREA_UNITS)[number]

const METRES_PER_FOOT = 0.3048

export const SQM_PER_SQFT = METRES_PER_FOOT ** 2

const SQM_PER_UNIT: Readonly<Record<AreaUnit, number>> = { sqm: 1, sqft: SQM_PER_SQFT }

export const areaToDisplay = (sqm: number, unit: AreaUnit) => sqm / SQM_PER_UNIT[unit]

export const areaFromDisplay = (shown: number, unit: AreaUnit) => shown * SQM_PER_UNIT[unit]

export const perAreaToDisplay = (perSqm: number, unit: AreaUnit) => perSqm * SQM_PER_UNIT[unit]

export const perAreaFromDisplay = (shown: number, unit: AreaUnit) => shown / SQM_PER_UNIT[unit]
