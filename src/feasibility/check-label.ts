import type { CheckId } from '@/designs'
import type { AreaTerms } from '@/region/regions'
import { t, type RatioCheckId } from '@/text/messages'

const isRatioCheck = (id: CheckId): id is RatioCheckId => id === 'far' || id === 'high-rise-far'

export const checkLabel = (id: CheckId, { ratio }: AreaTerms) => (isRatioCheck(id) ? t(`check.${id}`, { ratio }) : t(`check.${id}`))
