import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { isSourceCite, type Cite } from '@/rules'
import { t } from '@/text/messages'
import { Disclosure } from '@/ui/disclosure'
import { PACK } from './compute'
import { citeKey } from './rule-layers'

const unique = (cites: readonly Cite[]) => [...new Map(cites.map((cite) => [citeKey(cite), cite])).values()]

function EnteredItem({ field }: { field: string }) {
  return (
    <li className="flex flex-col gap-0.5 py-1.5 text-xs">
      <p className="font-medium text-foreground">{t('source.entered')}</p>
      <p className="text-muted-foreground">{field}</p>
    </li>
  )
}

function CiteItem({ cite }: { cite: Cite }) {
  if (!isSourceCite(cite)) return <EnteredItem field={cite.field} />
  const source = PACK.sources[cite.source]
  return (
    <li className="flex flex-col gap-0.5 py-1.5 text-xs">
      <p className="font-medium text-foreground">{source?.name ?? cite.source}</p>
      <p className="text-muted-foreground">{t('source.location', { page: cite.page, line: cite.line })}</p>
      {source && (
        <a
          href={`${source.url}#page=${cite.page}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 w-fit items-center gap-1 text-foreground underline decoration-foreground/25 underline-offset-3 transition-colors hover:decoration-foreground lg:min-h-0"
        >
          {t('source.open')}
          <ArrowSquareOutIcon aria-hidden="true" className="size-3.5" />
        </a>
      )}
    </li>
  )
}

export function Sources({ cites, className }: { cites: readonly Cite[]; className?: string }) {
  const shown = unique(cites)
  if (shown.length === 0) return null
  return (
    <Disclosure label={t('source.toggle', { count: shown.length })} className={className}>
      <ul className="mb-2 flex flex-col divide-y">
        {shown.map((cite) => (
          <CiteItem key={citeKey(cite)} cite={cite} />
        ))}
      </ul>
    </Disclosure>
  )
}
