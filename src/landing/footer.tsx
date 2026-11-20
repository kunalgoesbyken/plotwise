import { t } from '@/text/messages'
import { Logo } from '@/ui/logo'

export function Footer() {
  return (
    <footer className="border-t border-foreground/5">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span className="flex items-center gap-2 text-foreground">
          <Logo className="size-4" />
          {t('app.name')}
        </span>
        <span>{t('landing.footer.data')}</span>
      </div>
    </footer>
  )
}
