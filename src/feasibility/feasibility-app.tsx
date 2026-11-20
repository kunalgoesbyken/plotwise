'use client'

import { useMemo } from 'react'
import { EditorShell, type ResultPanel } from '@/editor/editor-shell'
import { EditorStoreProvider } from '@/editor/plot-store'
import { AssumptionsPanel, AssumptionsProvider, DesignMoney, LandValue, useMoneyRows } from '@/finance'
import { LandLine } from '@/finance/land-line'
import { PrintSummary } from '@/report/print-summary'
import { t } from '@/text/messages'
import { Disclosure } from '@/ui/disclosure'
import { ZoneStatus } from '@/zone'
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
  return [
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
}

function PlotZone() {
  const { plot } = useFeasibility()
  if (!plot) return null
  return (
    <div className="mt-2">
      <ZoneStatus ring={plot.ring} />
    </div>
  )
}

function Workspace() {
  const { result, design, layers } = useFeasibility()
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
            <ResultsSummary>
              <LandLine />
              <PlotZone />
            </ResultsSummary>
          }
          panels={panels}
          view3d={<FeasibilityScene />}
          overlay={overlay}
        />
      </div>
      <PrintSummary />
    </>
  )
}

export function FeasibilityApp() {
  return (
    <EditorStoreProvider>
      <FeasibilityProvider>
        <AssumptionsProvider>
          <Workspace />
        </AssumptionsProvider>
      </FeasibilityProvider>
    </EditorStoreProvider>
  )
}
