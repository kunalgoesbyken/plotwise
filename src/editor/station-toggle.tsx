'use client'

import { loadPack } from '@/rules'
import type { NearestStation } from '@/site/nearest-station'
import { stationDistance } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { useEditorState, useEditorStore } from './plot-store'
import { EstimateTag, PanelSection } from './ui'

const STATION_DISTANCE_M = stationDistance(loadPack('bkk-y9')).value

function nearestText(nearest: NearestStation): string {
  const name = nearest.name ?? nearest.nameTh ?? t('transit.unnamed')
  const distance = formatQuantity(nearest.distanceM, 'm')
  return t(nearest.measuredFrom === 'platform' ? 'transit.nearest-platform' : 'transit.nearest-station', { name, distance })
}

function NearestLine({ nearest, estimated }: { nearest: NearestStation | null; estimated: boolean }) {
  return (
    <p className="mt-2 flex items-baseline gap-2 text-xs leading-relaxed text-slate">
      {estimated && <EstimateTag />}
      <span>{nearest ? nearestText(nearest) : t('transit.none', { distance: formatQuantity(STATION_DISTANCE_M, 'm') })}</span>
    </p>
  )
}

export function StationToggle() {
  const store = useEditorStore()
  const { draft, siteStations, nearestStation } = useEditorState()
  const known = draft.status === 'closed' && siteStations !== null
  return (
    <PanelSection title={t('transit.title')}>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm lg:min-h-9">
        <input
          type="checkbox"
          checked={draft.nearStation}
          onChange={(e) => store.dispatch({ type: 'set-near-station', nearStation: e.target.checked })}
          className="size-4.5 shrink-0 accent-plot"
        />
        {t('transit.near', { distance: formatQuantity(STATION_DISTANCE_M, 'm') })}
      </label>
      {known && <NearestLine nearest={nearestStation} estimated={draft.nearStationSource === 'estimate'} />}
    </PanelSection>
  )
}
