'use client'

import { createContext, use, useMemo, useState, type ReactNode } from 'react'
import type { Design, TypologyId } from '@/designs'
import { usePlot, useRegion } from '@/editor/plot-store'
import { useHashState } from '@/editor/url-hash'
import type { Plot } from '@/plot/plot'
import { loadPack, type RulePack } from '@/rules'
import type { Envelope } from '@/solve'
import { feasibility, type Feasibility } from './compute'
import { carvingRules, envelopeLayers, RULE_STEPS, type CarvingRules, type EnvelopeLayers, type RuleStep } from './rule-layers'

export type FeasibilityView = {
  readonly pack: RulePack
  readonly plot: Plot | null
  readonly result: Feasibility | null
  readonly design: Design | null
  readonly envelope: Envelope | null
  readonly carving: CarvingRules | null
  readonly layers: EnvelopeLayers | null
  readonly farBonus: boolean
  readonly setFarBonus: (on: boolean) => void
  readonly selectDesign: (id: TypologyId) => void
  readonly chooseStep: (step: RuleStep) => void
}

const FeasibilityContext = createContext<FeasibilityView | null>(null)

const ALL_RULES = RULE_STEPS[RULE_STEPS.length - 1]

const FAR_MODE_IN_URL = { decode: (value: string | null) => value === 'bonus', encode: (bonus: boolean) => (bonus ? 'bonus' : null) }

export function FeasibilityProvider({ children }: { children: ReactNode }) {
  const plot = usePlot()
  const region = useRegion()
  const pack = loadPack(region.packId)
  const [farBonus, setFarBonus] = useHashState('far', FAR_MODE_IN_URL)
  const result = useMemo(() => plot && feasibility(plot, pack, farBonus ? 'bonus' : 'standard'), [plot, pack, farBonus])
  const [designId, setDesignId] = useState<TypologyId | null>(null)
  const [step, setStep] = useState<RuleStep>(ALL_RULES)
  const ready = result?.status === 'ready' ? result : null
  const design = ready ? (ready.designs.find((d) => d.id === designId) ?? ready.designs[0] ?? null) : null
  const envelope = ready ? (ready.solution.envelopes.find((e) => e.kind === design?.envelope) ?? ready.solution.envelopes.at(-1) ?? null) : null
  const solution = ready?.solution
  const carving = useMemo(() => (solution ? carvingRules(solution.pack) : null), [solution])
  const layers = useMemo(() => (envelope && solution && carving ? envelopeLayers(envelope, solution.site, step, carving) : null), [envelope, solution, step, carving])
  const view = useMemo(
    () => ({ pack, plot, result, design, envelope, carving, layers, farBonus, setFarBonus, selectDesign: setDesignId, chooseStep: setStep }),
    [pack, plot, result, design, envelope, carving, layers, farBonus, setFarBonus],
  )
  return <FeasibilityContext value={view}>{children}</FeasibilityContext>
}

export function useFeasibility(): FeasibilityView {
  const view = use(FeasibilityContext)
  if (!view) throw new Error('useFeasibility must be used inside FeasibilityProvider')
  return view
}
