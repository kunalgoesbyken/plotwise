'use client'

import { useId, useRef, useState, type ChangeEvent } from 'react'
import { FILE_ACCEPT, readImportFile } from '@/import/file'
import { georefFor, initialForm, type FrameForm } from '@/import/frame'
import { parsePasted } from '@/import/paste'
import { fail, type Georef, type Problem, type Result, type Shape, type Source } from '@/import/types'
import { checkShape, EARTH, shapeAreaSqm, shapeProblem, type Checked } from '@/import/validate'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Select } from '@/ui/select'
import { Textarea } from '@/ui/textarea'
import { ImportQuestions } from './import-questions'
import { problemText } from './import-problem'
import { useEditorStore, useRegion } from './plot-store'

type Imported =
  | { status: 'idle' }
  | { status: 'reading'; name: string }
  | { status: 'failed'; problem: Problem }
  | { status: 'ready'; source: Source; shape: number; form: FrameForm }

const IDLE: Imported = { status: 'idle' }

function importedFrom(result: Result<Source>): Imported {
  if (!result.ok) return { status: 'failed', problem: result.problem }
  const { shapes, question } = result.value
  const firstUsable = shapes.findIndex((shape) => shapeProblem(shape) === null)
  return { status: 'ready', source: result.value, shape: Math.max(firstUsable, 0), form: initialForm(question) }
}

const cornerCount = (shape: Shape) => t('plot.corners', { count: shape.points.length })

function shapeLabel(shape: Shape, index: number, georef: Georef | null): string {
  const name = shape.name ?? t('import.shape.unnamed', { number: String(index + 1) })
  const corners = cornerCount(shape)
  const label = georef
    ? t('import.shape.option-area', { name, corners, area: formatQuantity(shapeAreaSqm(shape, georef), 'sqm') })
    : t('import.shape.option', { name, corners })
  return shape.curved ? t('import.shape.curved', { label }) : label
}

function ShapePicker({ source, georef, value, onChange }: { source: Source; georef: Georef | null; value: number; onChange: (shape: number) => void }) {
  const id = useId()
  if (source.shapes.length < 2) return null
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{t('import.shape.label')}</Label>
      <Select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {source.shapes.map((shape, index) => (
          <option key={index} value={index}>
            {shapeLabel(shape, index, georef)}
          </option>
        ))}
      </Select>
    </div>
  )
}

function Verdict({ checked }: { checked: Result<Checked> | null }) {
  const store = useEditorStore()
  const region = useRegion()
  if (checked?.ok) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p aria-live="polite" className="text-sm font-medium">
          {t('import.result', { corners: t('plot.corners', { count: checked.value.ring.length }), area: formatQuantity(checked.value.areaSqm, region.areaUnit) })}
        </p>
        <Button onClick={() => store.dispatch({ type: 'import', ring: checked.value.ring })}>{t('import.use')}</Button>
      </div>
    )
  }
  return (
    <p aria-live="polite" className={checked ? 'text-sm leading-relaxed text-destructive' : 'text-xs leading-relaxed text-muted-foreground'}>
      {checked ? problemText(checked.problem, region) : t('import.incomplete')}
    </p>
  )
}

const useImportBounds = () => useRegion().bounds?.value ?? EARTH

function Review({ ready, onChange }: { ready: Extract<Imported, { status: 'ready' }>; onChange: (next: Imported) => void }) {
  const { source, shape, form } = ready
  const bounds = useImportBounds()
  const chosen = source.shapes[shape]
  const unusable = shapeProblem(chosen)
  const georef = georefFor(source.question, form)
  const patchForm = (patch: Partial<FrameForm>) => onChange({ ...ready, form: { ...form, ...patch } })

  return (
    <div className="flex flex-col gap-4">
      <ShapePicker source={source} georef={georef} value={shape} onChange={(next) => onChange({ ...ready, shape: next })} />
      {unusable ? (
        <Verdict checked={fail(unusable)} />
      ) : (
        <>
          <ImportQuestions question={source.question} form={form} onChange={patchForm} />
          <Verdict checked={georef && checkShape(chosen, georef, bounds)} />
        </>
      )}
    </div>
  )
}

function Outcome({ imported, onChange }: { imported: Imported; onChange: (next: Imported) => void }) {
  const region = useRegion()
  switch (imported.status) {
    case 'idle':
      return null
    case 'reading':
      return <p className="text-xs text-muted-foreground">{t('import.file.reading', { name: imported.name })}</p>
    case 'failed':
      return (
        <p role="alert" className="text-sm leading-relaxed text-destructive">
          {problemText(imported.problem, region)}
        </p>
      )
    case 'ready':
      return <Review ready={imported} onChange={onChange} />
  }
}

export function PlotImport() {
  const pasteId = useId()
  const fileId = useId()
  const [text, setText] = useState('')
  const [imported, setImported] = useState<Imported>(IDLE)
  const latest = useRef(0)
  const bounds = useImportBounds()

  const paste = (value: string) => {
    latest.current += 1
    setText(value)
    setImported(value.trim() === '' ? IDLE : importedFrom(parsePasted(value, bounds)))
  }

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const [file] = input.files ?? []
    if (!file) return
    latest.current += 1
    const token = latest.current
    setText('')
    setImported({ status: 'reading', name: file.name })
    const result = await readImportFile(file)
    input.value = ''
    if (token === latest.current) setImported(importedFrom(result))
  }

  return (
    <div className="flex flex-col gap-4 pt-2 pb-1">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={pasteId}>{t('import.paste.label')}</Label>
        <Textarea
          id={pasteId}
          value={text}
          onChange={(e) => paste(e.target.value)}
          placeholder={t('import.paste.placeholder')}
          spellCheck={false}
          autoComplete="off"
          className="font-mono text-sm"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">{t('import.paste.hint')}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fileId}>{t('import.file.label')}</Label>
        <Input id={fileId} type="file" accept={FILE_ACCEPT} onChange={choose} />
        <p className="text-xs leading-relaxed text-muted-foreground">{t('import.privacy')}</p>
      </div>
      <Outcome imported={imported} onChange={setImported} />
    </div>
  )
}
