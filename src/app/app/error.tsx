'use client'

import { APP_PATH } from '@/landing/links'
import { t } from '@/text/messages'
import { Button } from '@/ui/button'

export default function WorkspaceError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="text-xl font-medium text-balance">{t('app.error.title')}</h1>
      <p className="leading-relaxed text-pretty text-muted-foreground">{t('app.error.body')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild>
          <a href={APP_PATH}>{t('app.error.restart')}</a>
        </Button>
        <Button variant="outline" onClick={retry}>
          {t('app.error.retry')}
        </Button>
      </div>
    </main>
  )
}
