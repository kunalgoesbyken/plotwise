import { WarningCircleIcon } from '@phosphor-icons/react'
import type { Check, Design, ManualCheckId } from '@/designs'
import { useRegion } from '@/editor/plot-store'
import { t } from '@/text/messages'
import { checkLabel } from './check-label'
import { Sources } from './sources'

type ManualCheck = Extract<Check, { status: 'manual' }>

const isManual = (check: Check): check is ManualCheck => check.status === 'manual'

function ToCheckItem({ id, cites }: { id: ManualCheckId; cites: ManualCheck['cites'] }) {
  const { authority, areaTerms } = useRegion()
  return (
    <li className="py-2.5">
      <p className="text-sm font-medium leading-snug">{checkLabel(id, areaTerms)}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t(`to-check.why.${id}`)}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{t(`to-check.who.${id}`, { authority })}</p>
      <Sources cites={cites} />
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
          <ToCheckItem key={check.id} id={check.id} cites={check.cites} />
        ))}
      </ul>
    </section>
  )
}
