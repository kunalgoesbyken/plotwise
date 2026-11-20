import { REGIONS } from '@/region/regions'
import { t } from '@/text/messages'

type AnyRegion = (typeof REGIONS)[keyof typeof REGIONS]
type OtherRegion = Exclude<AnyRegion, { rules: 'pack' }>

const isUnverified = (region: AnyRegion): region is OtherRegion => region.rules !== 'pack'

type Described = { readonly region: OtherRegion; readonly worksFrom: string; readonly link: string }

function describe(region: OtherRegion): Described {
  switch (region.rules) {
    case 'draftPack':
      return {
        region,
        worksFrom: t('landing.from.draftPack', { name: region.name, plan: region.cityPlan.version }),
        link: t('landing.regions.draftPack', { name: region.name }),
      }
    case 'affectionPlan':
      return { region, worksFrom: t('landing.from.affectionPlan', { name: region.name }), link: t('landing.regions.affectionPlan', { name: region.name }) }
    case 'custom':
      return { region, worksFrom: t('landing.from.custom'), link: t('landing.regions.custom') }
  }
}

export const OTHER_REGIONS: readonly Described[] = Object.values(REGIONS).filter(isUnverified).map(describe)

export const OTHER_RULES = OTHER_REGIONS.map(({ worksFrom }) => worksFrom)
