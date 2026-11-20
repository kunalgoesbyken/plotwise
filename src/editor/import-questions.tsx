'use client'

import { useId, type ReactNode } from 'react'
import { LOCATE_METHODS, type FrameForm } from '@/import/frame'
import type { DegreeOrder, Question, UtmOrder } from '@/import/types'
import { LENGTH_UNITS } from '@/import/units'
import { HEMISPHERES, utmZoneAt } from '@/import/utm'
import { REGION } from '@/region/regions'
import { t } from '@/text/messages'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { Select } from '@/ui/select'

type Change = (patch: Partial<FrameForm>) => void
type Choice = { value: string; label: string }

const HINT = 'text-xs leading-relaxed text-muted-foreground'

function Choices({ legend, choices, value, onChange }: { legend: string; choices: readonly Choice[]; value: string; onChange: (value: string) => void }) {
  const name = useId()
  return (
    <fieldset className="flex flex-col">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {choices.map((choice) => (
        <label key={choice.value} className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm lg:min-h-8">
          <input
            type="radio"
            name={name}
            value={choice.value}
            checked={value === choice.value}
            onChange={() => onChange(choice.value)}
            className="size-4 accent-foreground"
          />
          {choice.label}
        </label>
      ))}
    </fieldset>
  )
}

function Field({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
    </div>
  )
}

function OrderChoice({ orders, form, onChange }: { orders: readonly (DegreeOrder | UtmOrder)[]; form: FrameForm; onChange: Change }) {
  if (orders.length < 2) return null
  return (
    <Choices
      legend={t('import.order.label')}
      choices={orders.map((order) => ({ value: order, label: t(`import.order.${order}`) }))}
      value={form.order}
      onChange={(order) => onChange({ order })}
    />
  )
}

function UtmFields({ form, onChange }: { form: FrameForm; onChange: Change }) {
  const { zone, hemisphere } = utmZoneAt(REGION.mapStart.value)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-3">
        <Field label={t('import.utm.zone')}>
          {(id) => <Input id={id} inputMode="numeric" autoComplete="off" value={form.zone} onChange={(e) => onChange({ zone: e.target.value })} />}
        </Field>
        <Field label={t('import.utm.hemisphere')}>
          {(id) => (
            <Select id={id} value={form.hemisphere} onChange={(e) => onChange({ hemisphere: e.target.value })}>
              <option value="" />
              {HEMISPHERES.map((side) => (
                <option key={side} value={side}>
                  {t(`import.utm.hemisphere.${side}`)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <p className={HINT}>{t('import.utm.hint', { city: REGION.city, zone: `${zone} ${hemisphere}` })}</p>
    </div>
  )
}

function ReferenceFields({ form, onChange }: { form: FrameForm; onChange: Change }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-3">
        <Field label={t('import.reference.lng')}>
          {(id) => <Input id={id} inputMode="decimal" autoComplete="off" value={form.refLng} onChange={(e) => onChange({ refLng: e.target.value })} />}
        </Field>
        <Field label={t('import.reference.lat')}>
          {(id) => <Input id={id} inputMode="decimal" autoComplete="off" value={form.refLat} onChange={(e) => onChange({ refLat: e.target.value })} />}
        </Field>
      </div>
      <p className={HINT}>{t('import.reference.hint')}</p>
    </div>
  )
}

function DrawingFields({ declared, form, onChange }: { declared: boolean; form: FrameForm; onChange: Change }) {
  return (
    <>
      <Field label={t('import.unit.label')}>
        {(id) => (
          <>
            <Select id={id} value={form.unit} onChange={(e) => onChange({ unit: e.target.value })}>
              <option value="">{t('import.unit.choose')}</option>
              {LENGTH_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {t(`import.unit.${unit}`)}
                </option>
              ))}
            </Select>
            <p className={HINT}>{t(declared ? 'import.unit.declared' : 'import.unit.undeclared')}</p>
          </>
        )}
      </Field>
      <Choices
        legend={t('import.locate.label')}
        choices={LOCATE_METHODS.map((method) => ({ value: method, label: t(`import.locate.${method}`) }))}
        value={form.locate}
        onChange={(locate) => onChange({ locate })}
      />
      {form.locate === 'utm' && <UtmFields form={form} onChange={onChange} />}
      {form.locate === 'reference' && <ReferenceFields form={form} onChange={onChange} />}
    </>
  )
}

export function ImportQuestions({ question, form, onChange }: { question: Question; form: FrameForm; onChange: Change }) {
  switch (question.kind) {
    case 'fixed':
      return null
    case 'degrees':
      return <OrderChoice orders={question.orders} form={form} onChange={onChange} />
    case 'utm':
      return (
        <>
          <OrderChoice orders={question.orders} form={form} onChange={onChange} />
          <UtmFields form={form} onChange={onChange} />
        </>
      )
    case 'drawing':
      return <DrawingFields declared={question.unit !== null} form={form} onChange={onChange} />
  }
}
