import type { Cite } from '@/rules'
import { t } from '@/text/messages'
import { PACK } from './compute'
import { Disclosure } from './disclosure'
import { citeKey } from './rule-layers'

const unique = (cites: readonly Cite[]) => [...new Map(cites.map((cite) => [citeKey(cite), cite])).values()]

function CiteItem({ cite }: { cite: Cite }) {
  const source = PACK.sources[cite.source]
  return (
    <li className="flex flex-col gap-1 border-l-2 border-plot/30 pl-2.5">
      <p className="font-mono text-[11px] text-slate">
        <span lang="th" className="text-ink">
          {cite.clause}
        </span>
        {t('source.location', { page: cite.page, line: cite.line })}
      </p>
      <blockquote lang="th" className="text-[13px] leading-relaxed break-words text-ink">
        {t('source.quote', { quote: cite.quote })}
      </blockquote>
      {source && (
        <a
          href={`${source.url}#page=${cite.page}`}
          target="_blank"
          rel="noreferrer"
          lang="th"
          className="inline-flex min-h-11 items-center text-xs break-words text-plot underline decoration-plot/30 underline-offset-2 hover:decoration-plot lg:min-h-0"
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
      <ul className="mt-1.5 mb-1 flex flex-col gap-3">
        {shown.map((cite) => (
          <CiteItem key={citeKey(cite)} cite={cite} />
        ))}
      </ul>
    </Disclosure>
  )
}
