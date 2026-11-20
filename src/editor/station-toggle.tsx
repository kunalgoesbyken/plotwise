'use client'

import { useId } from 'react'
import { loadPack } from '@/rules'
import type { NearestStation } from '@/site/nearest-station'
import { stationDistance } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { Checkbox } from '@/ui/checkbox'
import { Label } from '@/ui/label'
import { PanelSection } from '@/ui/section'
import { useEditorState, useEditorStore } from './plot-store'
import { EstimateTag } from './ui'

const STATION_DISTANCE_M = stationDistance(loadPack('bkk-y9')).value

function nearestText(nearest: NearestStation): string {
  const name = nearest.name ?? t('transit.unnamed')
  const distance = formatQuantity(nearest.distanceM, 'm')
  return t(nearest.measuredFrom === 'platform' ? 'transit.nearest-platform' : 'transit.nearest-station', { name, distance })
}

function NearestLine({ nearest, estimated }: { nearest: NearestStation | null; estimated: boolean }) {
  return (
    <p className="mt-2 flex items-baseline gap-2 text-xs leading-relaxed text-muted-foreground">
      {estimated && <EstimateTag />}
      <span>{nearest ? nearestText(nearest) : t('transit.none', { distance: formatQuantity(STATION_DISTANCE_M, 'm') })}</span>
    </p>
  )
}

export function StationToggle() {
  const store = useEditorStore()
  const id = useId()
  const { draft, siteStations, nearestStation } = useEditorState()
  if (draft.status !== 'closed') return null
  return (
    <PanelSection title={t('transit.title')}>
      <div className="flex min-h-11 items-center gap-3 lg:min-h-9">
        <Checkbox
          id={id}
          checked={draft.nearStation}
          onCheckedChange={(checked) => store.dispatch({ type: 'set-near-station', nearStation: checked === true })}
        />
        <Label htmlFor={id} className="cursor-pointer font-normal">
          {t('transit.near', { distance: formatQuantity(STATION_DISTANCE_M, 'm') })}
        </Label>
      </div>
      {siteStations !== null && <NearestLine nearest={nearestStation} estimated={draft.nearStationSource === 'estimate'} />}
    </PanelSection>
  )
}
