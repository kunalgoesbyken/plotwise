'use client'

import { useId } from 'react'
import { formatList, formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { Label } from '@/ui/label'
import { Switch } from '@/ui/switch'
import { useFeasibility } from './feasibility-provider'

export function FarBonusToggle() {
  const { result, farBonus, setFarBonus } = useFeasibility()
  const id = useId()
  if (result?.status !== 'ready') return null
  const { extraGfaSqm, measures } = result.solution.limits.farBonus
  if (extraGfaSqm <= 0) return null
  const needed = measures.filter((m) => m.eligible).map((m) => t(`bonus.${m.kind}`))
  return (
    <div>
      <div className="flex min-h-11 items-center gap-3 lg:min-h-9">
        <Switch id={id} checked={farBonus} onCheckedChange={setFarBonus} />
        <Label htmlFor={id} className="cursor-pointer font-normal">
          {t('far-bonus.label', { area: formatQuantity(extraGfaSqm, 'sqm') })}
        </Label>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('far-bonus.needs', { measures: formatList(needed) })}</p>
    </div>
  )
}
