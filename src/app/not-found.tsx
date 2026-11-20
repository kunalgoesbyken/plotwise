import { EXAMPLE_LINK } from '@/landing/example'
import { Footer } from '@/landing/footer'
import { APP_PATH } from '@/landing/links'
import { Nav } from '@/landing/nav'
import { PillLink } from '@/landing/pill-link'
import { t } from '@/text/messages'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-foreground">
      <Nav />
      <main className="mx-auto flex w-full max-w-3xl flex-1 animate-enter flex-col items-center justify-center px-5 py-24 text-center sm:px-8">
        <p className="text-sm text-muted-foreground">404</p>
        <h1 className="mt-4 text-heading font-medium text-balance">{t('landing.missing.title')}</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-pretty text-muted-foreground">{t('landing.missing.body')}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <PillLink href={APP_PATH}>{t('landing.open')}</PillLink>
          <PillLink href={EXAMPLE_LINK} quiet>
            {t('landing.hero.example')}
          </PillLink>
        </div>
      </main>
      <Footer />
    </div>
  )
}
