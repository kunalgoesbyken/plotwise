'use client'

import { createContext, use, useMemo, useState, type ReactNode } from 'react'
import type { Design, TypologyId } from '@/designs'
import { usePlot } from '@/editor/plot-store'
import type { Plot } from '@/plot/plot'
import type { Envelope } from '@/solve'
import { CARVING, feasibility, type Feasibility } from './compute'
import { envelopeLayers, RULE_STEPS, type EnvelopeLayers, type RuleStep } from './rule-layers'

export type FeasibilityView = {
  readonly plot: Plot | null
  readonly result: Feasibility | null
  readonly design: Design | null
  readonly envelope: Envelope | null
  readonly layers: EnvelopeLayers | null
  readonly farBonus: boolean
  readonly setFarBonus: (on: boolean) => void
  readonly selectDesign: (id: TypologyId) => void
  readonly chooseStep: (step: RuleStep) => void
}

const FeasibilityContext = createContext<FeasibilityView | null>(null)

const ALL_RULES = RULE_STEPS[RULE_STEPS.length - 1]

export function FeasibilityProvider({ children }: { children: ReactNode }) {
  const plot = usePlot()
  const [farBonus, setFarBonus] = useState(false)
  const result = useMemo(() => plot && feasibility(plot, farBonus ? 'bonus' : 'standard'), [plot, farBonus])
  const [designId, setDesignId] = useState<TypologyId | null>(null)
  const [step, setStep] = useState<RuleStep>(ALL_RULES)
  const ready = result?.status === 'ready' ? result : null
  const design = ready ? (ready.designs.find((d) => d.id === designId) ?? ready.designs[0] ?? null) : null
  const envelope = ready ? (ready.solution.envelopes.find((e) => e.kind === design?.envelope) ?? ready.solution.envelopes.at(-1) ?? null) : null
  const site = ready?.solution.site
  const layers = useMemo(() => (envelope && site ? envelopeLayers(envelope, site, step, CARVING) : null), [envelope, site, step])
  const view = useMemo(
    () => ({ plot, result, design, envelope, layers, farBonus, setFarBonus, selectDesign: setDesignId, chooseStep: setStep }),
    [plot, result, design, envelope, layers, farBonus],
  )
  return <FeasibilityContext value={view}>{children}</FeasibilityContext>
}

export function useFeasibility(): FeasibilityView {
  const view = use(FeasibilityContext)
  if (!view) throw new Error('useFeasibility must be used inside FeasibilityProvider')
  return view
}
