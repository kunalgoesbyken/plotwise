import type { Problem } from '@/import/types'
import { MAX_CORNERS } from '@/plot/plot'
import { REGION } from '@/region/regions'
import { ASSUMPTIONS } from '@/solve'
import { formatNumber, formatQuantity } from '@/text/format'
import { t } from '@/text/messages'

const BYTES_PER_MEGABYTE = 1_000_000

export function problemText(problem: Problem): string {
  switch (problem.reason) {
    case 'bad-entry':
      return t('import.problem.bad-entry', { entry: problem.entry })
    case 'outside-region':
      return t('import.problem.outside-region', { country: REGION.country })
    case 'too-many-corners':
      return t('import.problem.too-many-corners', { count: MAX_CORNERS })
    case 'too-small':
      return t('import.problem.too-small', { area: formatQuantity(ASSUMPTIONS.importMinPlotSqm.value, 'sqm') })
    case 'too-large':
      return t('import.problem.too-large', { area: formatQuantity(ASSUMPTIONS.importMaxPlotSqm.value, 'sqm') })
    case 'too-many-shapes':
      return t('import.problem.too-many-shapes', { count: ASSUMPTIONS.importMaxShapes.value })
    case 'file-too-large':
      return t('import.problem.file-too-large', { megabytes: formatNumber(ASSUMPTIONS.importMaxFileBytes.value / BYTES_PER_MEGABYTE, 'count') })
    default:
      return t(`import.problem.${problem.reason}`)
  }
}
