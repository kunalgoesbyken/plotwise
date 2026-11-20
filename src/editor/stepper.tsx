import { t } from '@/text/messages'
import { cn } from '@/ui/cn'
import type { EditorState } from './editor-state'
import { furthestStep, isOpen, STEPS, type Step } from './steps'

type StepperProps = { step: Step; state: EditorState; onChoose: (step: Step) => void }

export function Stepper({ step, state, onChoose }: StepperProps) {
  const furthest = STEPS.indexOf(furthestStep(state))
  return (
    <nav aria-label={t('shell.steps')} className="min-w-0 flex-1">
      <ol className="grid grid-cols-3 gap-1">
        {STEPS.map((id, index) => {
          const current = id === step
          const done = index < furthest && !current
          return (
            <li key={id}>
              <button
                type="button"
                aria-current={current ? 'step' : undefined}
                disabled={!isOpen(id, state)}
                onClick={() => onChoose(id)}
                className={cn(
                  'flex h-11 w-full items-center justify-center gap-2 rounded-md px-2 text-sm font-medium transition-colors lg:h-9',
                  'text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
                  'aria-[current=step]:text-foreground',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-full border text-2xs transition-colors',
                    current && 'border-foreground bg-foreground text-background',
                    done && 'border-foreground/40 text-foreground',
                  )}
                >
                  {index + 1}
                </span>
                {t(`flow.${id}`)}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
