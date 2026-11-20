'use client'

import { createContext, use } from 'react'
import type { Step } from './steps'

export type StepChoice = { readonly step: Step; readonly choose: (step: Step) => void }

export const StepChoiceContext = createContext<StepChoice | null>(null)

export function useStepChoice(): StepChoice {
  const choice = use(StepChoiceContext)
  if (!choice) throw new Error('useStepChoice must be used inside EditorShell')
  return choice
}
