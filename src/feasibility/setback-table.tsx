import type { Envelope, Setback } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { RuleSection } from './limit-row'
import type { Ready } from './ready'
import { siteEdgeNames } from './site-edges'
import { Sources } from './sources'

const groundSetbacks = (envelope: Envelope): readonly Setback[] | null => envelope.tiers[0]?.setbacks ?? null

export function SetbackTable({ plot, solution }: Pick<Ready, 'plot' | 'solution'>) {
  const { site, envelopes, limits } = solution
  const names = siteEdgeNames(plot, site)
  const columns = envelopes.flatMap((envelope) => {
    const setbacks = groundSetbacks(envelope)
    return setbacks ? [{ kind: envelope.kind, setbacks }] : []
  })
  const highRiseFrom = formatQuantity(limits.highRise.fromHeightM.value, 'm')
  return (
    <RuleSection title={t('rules.group.setbacks')} intro={t('rules.setbacks.detail')}>
      <table className="mt-3 w-full text-left text-sm tabular-nums">
        <thead>
          <tr className="border-b border-rule text-xs text-slate">
            <th scope="col" className="pb-1.5 font-normal">
              {t('rules.setbacks.edge')}
            </th>
            <th scope="col" className="pb-1.5 font-normal">
              {t('rules.setbacks.faces')}
            </th>
            {columns.map(({ kind }) => (
              <th key={kind} scope="col" className="pb-1.5 pl-3 text-right font-normal">
                {t(`rules.setbacks.${kind}`, { height: highRiseFrom })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-rule/70">
          {site.edges.map((edge, i) => (
            <tr key={i}>
              <th scope="row" className="py-2 pr-3 font-mono font-normal">
                {names[i]}
              </th>
              <td className={`py-2 text-xs ${edge.roadWidthM === null ? 'text-slate' : 'text-road-ink'}`}>
                {edge.roadWidthM === null ? t('rules.setbacks.boundary') : t('rules.setbacks.road', { width: formatQuantity(edge.roadWidthM, 'm') })}
              </td>
              {columns.map(({ kind, setbacks }) => (
                <td key={kind} className="py-2 pl-3 text-right font-mono">
                  {formatQuantity(setbacks[i].distanceM, 'm')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Sources cites={columns.flatMap(({ setbacks }) => setbacks.flatMap((s) => s.cites))} />
    </RuleSection>
  )
}
