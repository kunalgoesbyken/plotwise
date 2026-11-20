import type { EditorState } from './editor-state'

export const STEPS = ['plot', 'roads', 'results'] as const

export type Step = (typeof STEPS)[number]

export function furthestStep({ draft, plot }: EditorState): Step {
  if (plot) return 'results'
  return draft.status === 'closed' ? 'roads' : 'plot'
}

export function isOpen(step: Step, state: EditorState): boolean {
  return STEPS.indexOf(step) <= STEPS.indexOf(furthestStep(state))
}

export function shownStep(step: Step, state: EditorState): Step {
  return isOpen(step, state) ? step : furthestStep(state)
}

const pickedEdge = ({ selection: before }: EditorState, { selection: after }: EditorState) =>
  after.kind === 'edge' && (before.kind !== 'edge' || before.index !== after.index)

export function followEdits(step: Step, before: EditorState, after: EditorState): Step {
  if (after.loads !== before.loads) return furthestStep(after)
  if (after.draft.status !== before.draft.status) return after.draft.status === 'closed' ? 'roads' : 'plot'
  if (pickedEdge(before, after)) return 'roads'
  return step
}
