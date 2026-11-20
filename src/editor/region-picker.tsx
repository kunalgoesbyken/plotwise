'use client'

import { REGION_IDS, RegionIdSchema, REGIONS } from '@/region/regions'
import { t } from '@/text/messages'
import { PanelSection } from '@/ui/section'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { useEditorStore, useRegion } from './plot-store'

export function RegionPicker() {
  const store = useEditorStore()
  const region = useRegion()
  const choose = (value: string) => {
    const parsed = RegionIdSchema.safeParse(value)
    if (parsed.success) store.dispatch({ type: 'set-region', region: parsed.data })
  }
  return (
    <PanelSection title={t('region.title')} description={t(`region.${region.rules}`)}>
      <ToggleGroup type="single" variant="outline" aria-label={t('region.title')} value={region.id} onValueChange={choose} className="grid w-full grid-cols-3">
        {REGION_IDS.map((id) => (
          <ToggleGroupItem key={id} value={id} className="w-full data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background">
            {REGIONS[id].name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </PanelSection>
  )
}
