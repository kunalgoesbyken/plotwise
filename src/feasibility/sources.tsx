import type { Cite } from '@/rules'
import { t } from '@/text/messages'
import { PACK } from './compute'
import { Disclosure } from './disclosure'
import { citeKey } from './rule-layers'

const unique = (cites: readonly Cite[]) => [...new Map(cites.map((cite) => [citeKey(cite), cite])).values()]

function CiteItem({ cite }: { cite: Cite }) {
  const source = PACK.sources[cite.source]
  return (
    <li className="flex flex-col gap-1.5 rounded-lg bg-vellum px-3 py-2.5">
      <p className="text-xs text-slate">
        <span lang="th" className="font-medium text-ink">
          {cite.clause}
        </span>
        <span className="font-mono tabular-nums">{t('source.location', { page: cite.page, line: cite.line })}</span>
      </p>
      <blockquote lang="th" className="text-sm leading-relaxed break-words text-ink">
        {t('source.quote', { quote: cite.quote })}
      </blockquote>
      {source && (
        <a
          href={`${source.url}#page=${cite.page}`}
          target="_blank"
          rel="noreferrer"
          lang="th"
          className="inline-flex min-h-11 items-center text-xs break-words text-plot underline decoration-plot/30 underline-offset-2 transition-colors hover:decoration-plot lg:min-h-0"
        >
          {source.title}
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
