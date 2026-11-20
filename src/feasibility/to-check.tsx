import type { Check, Design, ManualCheckId } from '@/designs'
import { REGION } from '@/region/regions'
import { t } from '@/text/messages'
import { Sources } from './sources'

type ManualCheck = Extract<Check, { status: 'manual' }>

const isManual = (check: Check): check is ManualCheck => check.status === 'manual'

function ToCheckItem({ id, cites }: { id: ManualCheckId; cites: ManualCheck['cites'] }) {
  return (
    <li className="py-2.5">
      <p className="text-sm font-medium leading-snug">{t(`check.${id}`)}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t(`to-check.why.${id}`)}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{t(`to-check.who.${id}`, { authority: REGION.authority })}</p>
      <Sources cites={cites} />
    </li>
  )
}

export function ToCheck({ design, id }: { design: Design; id: string }) {
  const items = design.checks.filter(isManual)
  if (items.length === 0) return null
  return (
    <section id={id} tabIndex={-1} aria-labelledby={`${id}-title`} className="scroll-mt-4 border-l-2 border-road pl-3 outline-none">
      <h3 id={`${id}-title`} className="text-sm font-semibold text-road-foreground">
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
