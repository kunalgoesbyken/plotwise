'use client'

import { useMemo } from 'react'
import { EditorShell } from '@/editor/editor-shell'
import { EditorStoreProvider } from '@/editor/plot-store'
import { DesignsPanel } from './designs-panel'
import { FeasibilityProvider, useFeasibility } from './feasibility-provider'
import { FeasibilityScene } from './feasibility-scene'
import { mapOverlay } from './map-overlay'
import { RulesPanel } from './rules-panel'

function Workspace() {
  const { result, design, layers } = useFeasibility()
  const overlay = useMemo(() => {
    if (result?.status !== 'ready' || !layers) return undefined
    return mapOverlay(result.solution.site.frame, layers.shown[0]?.polygons ?? [], design?.plates.footprint ?? [])
  }, [result, design, layers])
  return <EditorShell rules={<RulesPanel />} designs={<DesignsPanel />} view3d={<FeasibilityScene />} overlay={overlay} />
}

export function FeasibilityApp() {
  return (
    <EditorStoreProvider>
      <FeasibilityProvider>
        <Workspace />
      </FeasibilityProvider>
    </EditorStoreProvider>
  )
}
