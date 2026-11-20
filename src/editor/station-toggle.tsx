'use client'

import { loadPack } from '@/rules'
import type { NearestStation } from '@/site/nearest-station'
import { stationDistance } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { PanelSection } from '@/ui/section'
import { SwitchRow } from '@/ui/switch'
import { useEditorState, useEditorStore, useRegion } from './plot-store'
import { EstimateTag } from './ui'

function nearestText(nearest: NearestStation): string {
  const name = nearest.name ?? t('transit.unnamed')
  const distance = formatQuantity(nearest.distanceM, 'm')
  return t(nearest.measuredFrom === 'platform' ? 'transit.nearest-platform' : 'transit.nearest-station', { name, distance })
}

function NearestLine({ nearest, estimated, distanceM }: { nearest: NearestStation | null; estimated: boolean; distanceM: number }) {
  return (
    <p className="mt-2 flex items-baseline gap-2 text-xs leading-relaxed text-muted-foreground">
      {estimated && <EstimateTag />}
      <span>{nearest ? nearestText(nearest) : t('transit.none', { distance: formatQuantity(distanceM, 'm') })}</span>
    </p>
  )
}

export function StationToggle() {
  const store = useEditorStore()
  const { draft, siteStations, nearestStation } = useEditorState()
  const region = useRegion()
  const stationDistanceM = stationDistance(loadPack(region.packId))?.value
  if (draft.status !== 'closed' || stationDistanceM === undefined) return null
  return (
    <PanelSection title={t('transit.title')}>
      <SwitchRow checked={draft.nearStation} onCheckedChange={(nearStation) => store.dispatch({ type: 'set-near-station', nearStation })}>
        {t('transit.near', { distance: formatQuantity(stationDistanceM, 'm') })}
      </SwitchRow>
      {siteStations !== null && (
        <NearestLine nearest={nearestStation} estimated={draft.nearStationSource === 'estimate'} distanceM={stationDistanceM} />
      )}
    </PanelSection>
  )
}
