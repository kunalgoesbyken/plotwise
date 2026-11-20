'use client'

import { LinkSimpleIcon, PrinterIcon } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { t } from '@/text/messages'
import { Button } from '@/ui/button'

const COPIED_FOR_MS = 2000

type CopyState = 'idle' | 'copied' | 'failed'

function useCopyLink() {
  const [state, setState] = useState<CopyState>('idle')
  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), COPIED_FOR_MS)
    return () => clearTimeout(timer)
  }, [state])
  const copy = () => {
    if (!navigator.clipboard) return setState('failed')
    navigator.clipboard.writeText(location.href).then(
      () => setState('copied'),
      () => setState('failed'),
    )
  }
  return { state, copy }
}

const COPY_LABEL = { idle: 'share.copy', copied: 'share.copied', failed: 'share.failed' } as const

export function ShareActions() {
  const { state, copy } = useCopyLink()
  return (
    <div className="flex gap-1 print:hidden">
      <Button variant="ghost" size="sm" onClick={copy}>
        <LinkSimpleIcon aria-hidden="true" />
        {t(COPY_LABEL[state])}
      </Button>
      <span role="status" className="sr-only">
        {state === 'idle' ? '' : t(COPY_LABEL[state])}
      </span>
      <Button variant="ghost" size="sm" onClick={() => print()}>
        <PrinterIcon aria-hidden="true" />
        {t('share.print')}
      </Button>
    </div>
  )
}
