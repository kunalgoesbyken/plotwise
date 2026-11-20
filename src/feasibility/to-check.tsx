import { WarningCircleIcon } from '@phosphor-icons/react'
import type { Check, Design } from '@/designs'
import { limitName } from '@/editor/limit-fields'
import { useRegion } from '@/editor/plot-store'
import type { Region } from '@/region/regions'
import { t } from '@/text/messages'
import { checkLabel } from './check-label'
import { Sources } from './sources'

type ManualCheck = Extract<Check, { status: 'manual' }>

const isManual = (check: Check): check is ManualCheck => check.status === 'manual'

function reasons(check: ManualCheck, region: Region): readonly [why: string, who: string] {
  if ('unentered' in check) {
    return [
      t('to-check.why.unentered', { limit: limitName(check.unentered, region) }),
      t('to-check.who.unentered', { document: region.limitTerms?.document.value ?? t('to-check.document.own') }),
    ]
  }
  return [t(`to-check.why.${check.id}`), t(`to-check.who.${check.id}`, { authority: region.authority })]
}

function ToCheckItem({ check }: { check: ManualCheck }) {
  const region = useRegion()
  const [why, who] = reasons(check, region)
  return (
    <li className="py-2.5">
      <p className="text-sm font-medium leading-snug">{checkLabel(check.id, region.areaTerms)}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{why}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{who}</p>
      <Sources cites={check.cites} />
    </li>
  )
}

export function ToCheck({ design, id }: { design: Design; id: string }) {
  const items = design.checks.filter(isManual)
  if (items.length === 0) return null
  return (
    <section id={id} tabIndex={-1} aria-labelledby={`${id}-title`} className="scroll-mt-4 rounded-md outline-none focus-visible:animate-flash">
      <h3 id={`${id}-title`} className="flex items-center gap-2 text-sm font-medium">
        <WarningCircleIcon aria-hidden="true" weight="fill" className="size-4 text-road" />
        {t('to-check.title', { count: items.length })}
      </h3>
      <ul className="divide-y">
        {items.map((check) => (
          <ToCheckItem key={check.id} check={check} />
        ))}
      </ul>
    </section>
  )
}
