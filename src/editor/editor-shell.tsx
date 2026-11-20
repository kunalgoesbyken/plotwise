'use client'

import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { t } from '@/text/messages'
import { Button } from '@/ui/button'
import { cn } from '@/ui/cn'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { BuildingTypePicker } from './building-type'
import type { EditorAction, EditorState } from './editor-state'
import { Frontage } from './frontage'
import { HintBar } from './hint-bar'
import type { MapOverlay } from './map-layers'
import { PlotMap } from './plot-map'
import { PlotStep } from './plot-step'
import { useEditorState, useEditorStore, type EditorStore } from './plot-store'
import { StationToggle } from './station-toggle'
import { Stepper } from './stepper'
import { followEdits, furthestStep, isOpen, shownStep, STEPS, type Step } from './steps'

export type EditorSlots = {
  summary?: ReactNode
  rules?: ReactNode
  designs?: ReactNode
  view3d?: ReactNode
  overlay?: MapOverlay
}

const RESULT_TABS = ['designs', 'rules', 'view3d'] as const

type ResultTab = (typeof RESULT_TABS)[number]

const isResultTab = (value: string): value is ResultTab => (RESULT_TABS as readonly string[]).includes(value)

const INTERACTIVE = 'input, select, textarea, button, a[href], [contenteditable]'

function isOnControl(target: EventTarget | null) {
  return target instanceof Element && target.closest(INTERACTIVE) !== null
}

function shortcut(key: string, { draft, selection }: EditorState): EditorAction | null {
  if (key === 'Escape') return { type: 'select', selection: { kind: 'none' } }
  if (key === 'Enter' && draft.status === 'drawing') return { type: 'close' }
  if (key !== 'Backspace' && key !== 'Delete') return null
  if (draft.status === 'drawing') return { type: 'undo' }
  if (selection.kind === 'corner') return { type: 'remove', corner: selection.index }
  if (selection.kind === 'edge') return { type: 'unmark-road', edge: selection.index }
  return null
}

function useShortcuts(store: EditorStore) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isOnControl(event.target)) return
      const action = shortcut(event.key, store.getState())
      if (!action) return
      event.preventDefault()
      store.dispatch(action)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [store])
}

function useStep(state: EditorState, onMove: () => void) {
  const [chosen, setChosen] = useState<Step>(() => furthestStep(state))
  const [seen, setSeen] = useState(state)
  if (seen !== state) {
    setSeen(state)
    const next = followEdits(chosen, seen, state)
    if (next !== chosen) {
      setChosen(next)
      onMove()
    }
  }
  return [shownStep(chosen, state), setChosen] as const
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <Image src="/icon.svg" width={24} height={24} alt="" unoptimized priority />
      <span className="text-lg leading-none font-semibold tracking-tight">{t('app.name')}</span>
      <span className="text-sm leading-none text-muted-foreground">{t('app.city')}</span>
    </div>
  )
}

function StepFooter({ step, state, onChoose }: { step: Step; state: EditorState; onChoose: (step: Step) => void }) {
  const index = STEPS.indexOf(step)
  const previous = STEPS[index - 1]
  const next = STEPS[index + 1]
  return (
    <footer className="flex shrink-0 items-center gap-2 border-t px-(--pad) py-2">
      {previous && (
        <Button variant="ghost" onClick={() => onChoose(previous)}>
          <ChevronLeft aria-hidden="true" />
          {t('flow.back')}
        </Button>
      )}
      {next && step !== 'results' && (
        <Button className="ml-auto" disabled={!isOpen(next, state)} onClick={() => onChoose(next)}>
          {t(`flow.next.${step}`)}
          <ChevronRight aria-hidden="true" />
        </Button>
      )}
    </footer>
  )
}

type ResultsProps = Pick<EditorSlots, 'summary' | 'rules' | 'designs'> & { tab: ResultTab; onTab: (tab: ResultTab) => void; sceneId: string }

function Results({ summary, rules, designs, tab, onTab, sceneId }: ResultsProps) {
  return (
    <>
      <BuildingTypePicker />
      {summary && <div className={cn('sticky top-0 z-10 border-y bg-background px-(--pad) py-4', tab === 'view3d' && 'max-xl:hidden')}>{summary}</div>}
      <Tabs value={tab} onValueChange={(value) => isResultTab(value) && onTab(value)} className="gap-4 px-(--pad) pt-4 pb-5">
        <TabsList variant="line" aria-label={t('tab.label')} className="w-full justify-start border-b">
          <TabsTrigger value="designs">{t('tab.designs')}</TabsTrigger>
          <TabsTrigger value="rules">{t('tab.rules')}</TabsTrigger>
          <TabsTrigger value="view3d" aria-controls={sceneId} className="xl:hidden">
            {t('tab.view3d')}
          </TabsTrigger>
        </TabsList>
        <TabsContent forceMount value="designs" className="data-[state=inactive]:hidden">
          {designs}
        </TabsContent>
        <TabsContent forceMount value="rules" className="data-[state=inactive]:hidden">
          {rules}
        </TabsContent>
      </Tabs>
    </>
  )
}

export function EditorShell({ summary, rules, designs, view3d, overlay }: EditorSlots) {
  const store = useEditorStore()
  const state = useEditorState()
  const panel = useRef<HTMLElement>(null)
  const inset = useRef<HTMLElement>(null)
  const covers = useMemo(() => [panel, inset], [])
  const sceneId = useId()
  const [open, setOpen] = useState(true)
  const [step, setStep] = useStep(state, () => setOpen(true))
  const [tab, setTab] = useState<ResultTab>('designs')
  useShortcuts(store)

  const ready = state.plot !== null
  const choose = (next: Step) => {
    setStep(next)
    setOpen(true)
  }
  const sceneInPanel = step === 'results' && tab === 'view3d'

  return (
    <main className="relative h-dvh w-full overflow-clip [--panel-w:24rem] 2xl:[--panel-w:27rem]">
      <PlotMap covers={covers} overlay={overlay} />
      <aside
        ref={panel}
        aria-label={t('shell.panel')}
        data-scene={sceneInPanel}
        className="absolute inset-x-0 bottom-0 z-10 flex max-h-[min(36rem,64dvh)] flex-col max-lg:data-[scene=true]:max-h-[85dvh] rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px] shadow-foreground/25 [--pad:1rem] md:inset-x-auto md:bottom-3 md:left-3 md:w-[26rem] md:rounded-2xl md:border md:pb-0 md:shadow-xl lg:inset-y-3 lg:right-3 lg:left-auto lg:max-h-none lg:w-(--panel-w) lg:rounded-xl lg:[--pad:1.25rem]"
      >
        <header className="hidden h-14 shrink-0 items-center border-b px-(--pad) lg:flex">
          <Wordmark />
        </header>
        <div className="flex shrink-0 items-center gap-1 px-2 pt-2 lg:px-(--pad) lg:pt-3">
          <Stepper step={step} state={state} onChoose={choose} />
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t(open ? 'shell.hide' : 'shell.show')} aria-expanded={open} onClick={() => setOpen(!open)}>
            <ChevronDown aria-hidden="true" className={cn('transition-transform', !open && 'rotate-180')} />
          </Button>
        </div>
        <HintBar />
        <div className={cn('thin-scroll min-h-0 flex-1 scroll-pt-40 overflow-y-auto overscroll-contain', !open && 'max-lg:hidden')}>
          {step === 'plot' && <PlotStep />}
          {step === 'roads' && (
            <>
              {ready && summary && <div className="sticky top-0 z-10 border-b bg-background px-(--pad) py-3">{summary}</div>}
              <Frontage />
              <StationToggle />
            </>
          )}
          {step === 'results' && <Results summary={summary} rules={rules} designs={designs} tab={tab} onTab={setTab} sceneId={sceneId} />}
          <section
            ref={inset}
            id={sceneId}
            aria-label={t('section.view3d')}
            className={cn(
              sceneInPanel ? 'max-xl:h-[50dvh]' : 'max-xl:hidden',
              ready && view3d ? 'xl:fixed xl:bottom-3 xl:left-3 xl:h-[48vh] xl:w-[min(40rem,calc((100vw-var(--panel-w))*0.5))] xl:overflow-hidden xl:rounded-xl xl:border xl:bg-background xl:shadow-xl' : 'xl:hidden',
            )}
          >
            {ready && view3d}
          </section>
        </div>
        <div className={cn(!open && 'max-lg:hidden')}>
          <StepFooter step={step} state={state} onChoose={choose} />
        </div>
      </aside>
    </main>
  )
}
