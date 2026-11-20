import type { ReactNode } from 'react'
import { checkLabel } from '@/feasibility/check-label'
import { rangeText } from '@/finance/figures'
import { DEFAULT_REGION } from '@/region/regions'
import { formatList, formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import type { ExampleFigures } from './example'

function Claim({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <li className="reveal grid gap-4 py-8 sm:grid-cols-2 sm:gap-10">
      <div>
        <h3 className="text-lg font-medium tracking-tight">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <div className="flex flex-col gap-1 text-sm leading-relaxed">{children}</div>
    </li>
  )
}

function Cited({ cited }: Pick<ExampleFigures, 'cited'>) {
  return cited.map(({ id, cite, source }) => (
    <p key={id}>
      <span className="font-medium">{checkLabel(id, DEFAULT_REGION.areaTerms)}</span>
      <span className="text-muted-foreground">
        {' '}
        · {source}, {t('source.location', { page: cite.page, line: cite.line })}
      </span>
    </p>
  ))
}

function Unconfirmed({ toCheck }: Pick<ExampleFigures, 'toCheck'>) {
  if (toCheck.length === 0) return <p className="text-muted-foreground">{t('landing.check.none')}</p>
  return <p>{formatList(toCheck.map((id) => checkLabel(id, DEFAULT_REGION.areaTerms)))}</p>
}

function Ranges({ firstCost, landValue, currency }: Pick<ExampleFigures, 'firstCost' | 'landValue' | 'currency'>) {
  return (
    <>
      <p>
        <span className="text-muted-foreground">{t('landing.money.cost')} </span>
        <span className="font-medium">{rangeText(firstCost, currency)}</span>
      </p>
      <p>
        <span className="text-muted-foreground">{t('landing.money.land')} </span>
        <span className="font-medium">{rangeText(landValue, currency)}</span>
      </p>
    </>
  )
}

export function Proof({ figures }: { figures: ExampleFigures }) {
  return (
    <ul className="divide-y border-y">
      <Claim title={t('landing.sources.title')} body={t('landing.sources.body')}>
        <Cited cited={figures.cited} />
      </Claim>
      <Claim title={t('landing.envelope.title')} body={t('landing.envelope.body')}>
        <p>{t('landing.envelope.evidence', { buildable: formatQuantity(figures.buildableSqm, 'sqm'), area: formatQuantity(figures.plotSqm, 'sqm') })}</p>
      </Claim>
      <Claim title={t('landing.check.title')} body={t('landing.check.body')}>
        <Unconfirmed toCheck={figures.toCheck} />
      </Claim>
      <Claim title={t('landing.money.title')} body={t('landing.money.body')}>
        <Ranges firstCost={figures.firstCost} landValue={figures.landValue} currency={figures.currency} />
      </Claim>
    </ul>
  )
}
