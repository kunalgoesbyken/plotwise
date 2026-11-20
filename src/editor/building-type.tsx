'use client'

import { BUILDING_TYPES, type BuildingType } from '@/plot/plot'
import type { Region } from '@/region/regions'
import { loadPack } from '@/rules'
import { t } from '@/text/messages'
import { PanelSection } from '@/ui/section'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { useEditorState, useEditorStore, useRegion } from './plot-store'

const isBuildingType = (value: string): value is BuildingType => (BUILDING_TYPES as readonly string[]).includes(value)

const hintFor = ({ name, covers }: Region) => (covers ? t('building-type.hint.covered', { region: name, ...covers }) : t('building-type.hint'))

export function BuildingTypePicker() {
  const store = useEditorStore()
  const { draft } = useEditorState()
  const region = useRegion()
  const types = loadPack(region.packId).buildingTypes ?? BUILDING_TYPES
  return (
    <PanelSection title={t('building-type.title')} description={hintFor(region)}>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-label={t('building-type.title')}
        value={draft.buildingType}
        onValueChange={(value) => isBuildingType(value) && store.dispatch({ type: 'set-building-type', buildingType: value })}
        className="grid w-full grid-cols-3"
      >
        {types.map((type) => (
          <ToggleGroupItem key={type} value={type} className="w-full data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background">
            {region.buildingNames[type]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </PanelSection>
  )
}
