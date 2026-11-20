import { AREA_TOLERANCE_SQM, type Design } from './designs'

export function headline(designs: readonly Design[]): Design | null {
  const mostSqm = Math.max(...designs.map((d) => d.metrics.gfaSqm))
  return designs
    .filter((d) => d.metrics.gfaSqm >= mostSqm - AREA_TOLERANCE_SQM)
    .reduce<Design | null>((lowest, d) => (!lowest || d.metrics.heightM < lowest.metrics.heightM ? d : lowest), null)
}
