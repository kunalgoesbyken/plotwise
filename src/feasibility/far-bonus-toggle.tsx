'use client'

import { formatList, formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { SwitchRow } from '@/ui/switch'
import { useFeasibility } from './feasibility-provider'

export function FarBonusToggle() {
  const { result, farBonus, setFarBonus } = useFeasibility()
  if (result?.status !== 'ready') return null
  const { extraGfaSqm, measures } = result.solution.limits.farBonus
  if (extraGfaSqm <= 0) return null
  const needed = measures.filter((m) => m.eligible).map((m) => t(`bonus.${m.kind}`))
  return (
    <div>
      <SwitchRow checked={farBonus} onCheckedChange={setFarBonus}>
        {t('far-bonus.label', { area: formatQuantity(extraGfaSqm, 'sqm') })}
      </SwitchRow>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('far-bonus.needs', { measures: formatList(needed) })}</p>
    </div>
  )
}
