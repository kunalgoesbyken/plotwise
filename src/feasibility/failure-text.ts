import { formatAlternatives } from '@/text/format'
import { t } from '@/text/messages'
import type { Failure } from './compute'

export function failureText(failure: Failure): string {
  if (failure.reason === 'plot-limit-missing') {
    return t('feasibility.failed.plot-limit-missing', { limits: formatAlternatives(failure.fields.map((field) => t(`plot-limit.${field}`))) })
  }
  return t(`feasibility.failed.${failure.reason}`)
}
