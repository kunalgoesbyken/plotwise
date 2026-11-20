'use client'

import { LinkSimpleIcon, PrinterIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { t } from '@/text/messages'
import { Button } from '@/ui/button'

const COPIED_FOR_MS = 2000

function useCopyLink() {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_FOR_MS)
    return () => clearTimeout(timer)
  }, [copied])
  const copy = () => navigator.clipboard.writeText(location.href).then(() => setCopied(true))
  return { copied, copy }
}

export function ShareActions() {
  const { copied, copy } = useCopyLink()
  return (
    <div className="flex gap-1 print:hidden">
      <Button variant="ghost" size="sm" onClick={copy} aria-live="polite">
        <LinkSimpleIcon aria-hidden="true" />
        {t(copied ? 'share.copied' : 'share.copy')}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => print()}>
        <PrinterIcon aria-hidden="true" />
        {t('share.print')}
      </Button>
    </div>
  )
}
