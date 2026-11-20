import type { Problem } from '@/import/types'
import { MAX_CORNERS } from '@/plot/plot'
import type { Region } from '@/region/regions'
import { ASSUMPTIONS } from '@/solve'
import { formatNumber, formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { exampleCorners } from './corner-example'

const BYTES_PER_MEGABYTE = 1_000_000

export function problemText(problem: Problem, region: Region): string {
  const { country, name, areaUnit } = region
  switch (problem.reason) {
    case 'bad-entry':
      return t('import.problem.bad-entry', { entry: problem.entry, corner: exampleCorners(region)[0] })
    case 'outside-region':
      return t('import.problem.outside-region', { country: country ?? name })
    case 'too-many-corners':
      return t('import.problem.too-many-corners', { count: MAX_CORNERS })
    case 'too-small':
      return t('import.problem.too-small', { area: formatQuantity(ASSUMPTIONS.importMinPlotSqm.value, areaUnit) })
    case 'too-large':
      return t('import.problem.too-large', { area: formatQuantity(ASSUMPTIONS.importMaxPlotSqm.value, areaUnit) })
    case 'too-many-shapes':
      return t('import.problem.too-many-shapes', { count: ASSUMPTIONS.importMaxShapes.value })
    case 'file-too-large':
      return t('import.problem.file-too-large', { megabytes: formatNumber(ASSUMPTIONS.importMaxFileBytes.value / BYTES_PER_MEGABYTE, 'count') })
    default:
      return t(`import.problem.${problem.reason}`)
  }
}
