'use client'

import { useMemo } from 'react'
import { PlotScene } from '@/scene/plot-scene'
import { useFeasibility } from './feasibility-provider'
import { RuleStepper } from './rule-stepper'

export function FeasibilityScene() {
  const { result, design, layers, strip } = useFeasibility()
  const designs = useMemo(
    () => (result?.status === 'ready' ? result.designs.map((d) => ({ id: d.id, floors: d.plates.floors })) : []),
    [result],
  )
  return (
    <PlotScene
      envelope={layers?.shown ?? []}
      carved={layers?.carved}
      strip={strip}
      designs={designs}
      selectedDesignId={design?.id}
      controls={<RuleStepper />}
    />
  )
}
