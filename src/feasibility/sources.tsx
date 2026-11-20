import { ExternalLink } from 'lucide-react'
import type { Cite } from '@/rules'
import { t } from '@/text/messages'
import { Disclosure } from '@/ui/disclosure'
import { PACK } from './compute'
import { citeKey } from './rule-layers'

const unique = (cites: readonly Cite[]) => [...new Map(cites.map((cite) => [citeKey(cite), cite])).values()]

function CiteItem({ cite }: { cite: Cite }) {
  const source = PACK.sources[cite.source]
  return (
    <li className="flex flex-col gap-0.5 rounded-lg bg-muted px-3 py-2.5 text-xs">
      <p className="font-medium text-foreground">{source?.name ?? cite.source}</p>
      <p className="text-muted-foreground">{t('source.location', { page: cite.page, line: cite.line })}</p>
      {source && (
        <a
          href={`${source.url}#page=${cite.page}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 w-fit items-center gap-1 font-medium text-primary underline-offset-2 hover:underline lg:min-h-0"
        >
          {t('source.open')}
          <ExternalLink aria-hidden="true" className="size-3" />
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
      <ul className="mt-1 mb-2 flex flex-col gap-2">
        {shown.map((cite) => (
          <CiteItem key={citeKey(cite)} cite={cite} />
        ))}
      </ul>
    </Disclosure>
  )
}
