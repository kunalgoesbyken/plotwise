'use client'

import { CaretRightIcon } from '@phosphor-icons/react'
import { useRegion } from '@/editor/plot-store'
import { useStepChoice } from '@/editor/step-choice'
import { Button } from '@/ui/button'
import type { Failure } from './compute'
import { failureText } from './failure-text'

export function FailureNotice({ failure }: { failure: Failure }) {
  const region = useRegion()
  const { step, choose } = useStepChoice()
  const text = failureText(failure, region)
  if (failure.reason !== 'plot-limit-missing' || step === 'roads') {
    return (
      <p role="alert" className="text-sm leading-snug text-destructive">
        {text}
      </p>
    )
  }
  return (
    <div role="alert">
      <Button
        variant="outline"
        onClick={() => choose('roads')}
        className="h-auto w-full justify-between border-destructive/40 bg-destructive/5 py-3 text-left leading-snug font-normal whitespace-normal text-destructive hover:bg-destructive/10 hover:text-destructive lg:h-auto"
      >
        {text}
        <CaretRightIcon aria-hidden="true" weight="bold" />
      </Button>
    </div>
  )
}
