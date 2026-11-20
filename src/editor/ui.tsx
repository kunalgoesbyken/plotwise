import { t } from '@/text/messages'
import { Badge } from '@/ui/badge'

export function PointerText({ text }: { text: (verb: string) => string }) {
  return (
    <>
      <span className="pointer-coarse:hidden">{text(t('verb.click'))}</span>
      <span className="hidden pointer-coarse:inline">{text(t('verb.tap'))}</span>
    </>
  )
}

export function EstimateTag() {
  return (
    <Badge variant="road" aria-hidden="true" className="px-1.5 py-0">
      {t('frontage.estimated-tag')}
    </Badge>
  )
}
