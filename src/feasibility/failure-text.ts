import { limitName } from '@/editor/limit-fields'
import type { Region } from '@/region/regions'
import { formatAlternatives } from '@/text/format'
import { t } from '@/text/messages'
import type { Failure } from './compute'

export function failureText(failure: Failure, region: Region): string {
  if (failure.reason === 'plot-limit-missing') {
    return t('feasibility.failed.plot-limit-missing', { limits: formatAlternatives(failure.fields.map((field) => limitName(field, region))) })
  }
  return t(`feasibility.failed.${failure.reason}`)
}
