'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { EditorShell, type ResultPanel } from '@/editor/editor-shell'
import { EditorStoreProvider, useRegion } from '@/editor/plot-store'
import { useHashState } from '@/editor/url-hash'
import { AssumptionsPanel, AssumptionsProvider, DesignMoney, LandValue, useMoneyRows } from '@/finance'
import { LandLine } from '@/finance/land-line'
import { PrintSummary } from '@/report/print-summary'
import { t } from '@/text/messages'
import { Disclosure } from '@/ui/disclosure'
import { ZoneGateProvider, ZoneHeld, ZoneHold, ZoneStatus, useZoneGate } from '@/zone'
import { DesignsPanel } from './designs-panel'
import { FarBonusToggle } from './far-bonus-toggle'
import { FeasibilityProvider, useFeasibility } from './feasibility-provider'
import { FeasibilityScene } from './feasibility-scene'
import { mapOverlay } from './map-overlay'
import { ResultsSummary } from './results-summary'
import { RulesPanel } from './rules-panel'
import { WidthSensitivity } from './width-sensitivity-table'

function usePanels(): readonly ResultPanel[] {
  const moneyRows = useMoneyRows()
  const { cleared } = useZoneGate()
  const panels = [
    {
      id: 'designs',
      label: t('tab.designs'),
      content: (
        <div className="flex flex-col gap-5">
          <FarBonusToggle />
          <DesignsPanel extraRows={moneyRows} />
          <Disclosure label={t('sensitivity.label')}>
            <WidthSensitivity />
          </Disclosure>
        </div>
      ),
    },
    {
      id: 'money',
      label: t('tab.money'),
      content: (
        <div className="flex flex-col gap-8">
          <LandValue />
          <DesignMoney />
          <Disclosure label={t('assumptions.all')}>
            <div className="pt-3">
              <AssumptionsPanel />
            </div>
          </Disclosure>
        </div>
      ),
    },
    { id: 'rules', label: t('tab.rules'), content: <RulesPanel /> },
  ]
  return cleared ? panels : panels.map((panel) => ({ ...panel, content: <ZoneHeld /> }))
}

function PlotZone() {
  const { zone } = useZoneGate()
  const { plot } = useFeasibility()
  if (!plot || !zone) return null
  return (
    <div className="mt-2">
      <ZoneStatus />
    </div>
  )
}

function Workspace() {
  const { result, design, layers } = useFeasibility()
  const { cleared } = useZoneGate()
  const panels = usePanels()
  const overlay = useMemo(() => {
    if (result?.status !== 'ready' || !layers) return undefined
    return mapOverlay(result.solution.site.frame, layers.shown[0]?.polygons ?? [], design?.plates.footprint ?? [])
  }, [result, design, layers])
  return (
    <>
      <div className="contents print:hidden">
        <EditorShell
          summary={
            cleared ? (
              <ResultsSummary>
                <LandLine />
                <PlotZone />
              </ResultsSummary>
            ) : (
              <ZoneHold />
            )
          }
          panels={panels}
          view3d={<FeasibilityScene />}
          overlay={overlay}
        />
      </div>
      {cleared && <PrintSummary />}
    </>
  )
}

const ZONE_CONFIRMED_IN_URL = { decode: (value: string | null) => value === 'confirmed', encode: (confirmed: boolean) => (confirmed ? 'confirmed' : null) }

function GatedWorkspace() {
  const { plot } = useFeasibility()
  const region = useRegion()
  const [confirmed, setConfirmed] = useHashState('zone', ZONE_CONFIRMED_IN_URL)
  const confirm = useCallback(() => setConfirmed(true), [setConfirmed])
  const hadPlot = useRef(false)
  useEffect(() => {
    if (plot) hadPlot.current = true
    else if (hadPlot.current) {
      hadPlot.current = false
      setConfirmed(false)
    }
  }, [plot, setConfirmed])
  return (
    <ZoneGateProvider zone={region.zone?.name ?? null} ring={plot?.ring ?? null} confirmed={confirmed} onConfirm={confirm}>
      <Workspace />
    </ZoneGateProvider>
  )
}

export function FeasibilityApp() {
  return (
    <EditorStoreProvider>
      <FeasibilityProvider>
        <AssumptionsProvider>
          <GatedWorkspace />
        </AssumptionsProvider>
      </FeasibilityProvider>
    </EditorStoreProvider>
  )
}
