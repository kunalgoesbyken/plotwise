import { GithubLogoIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { t } from '@/text/messages'
import { Logo } from '@/ui/logo'
import { APP_PATH, REPO_URL } from './links'

type NavProps = { readonly sections?: boolean }

export function Nav({ sections = false }: NavProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-foreground/5 bg-canvas/80 backdrop-blur-md">
      <nav aria-label={t('landing.nav.label')} className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Logo className="size-6" />
          {t('app.name')}
        </Link>
        {sections && (
          <div className="hidden gap-6 text-sm md:flex">
            <a href="#how" className="transition-colors hover:text-muted-foreground">
              {t('landing.nav.how')}
            </a>
            <a href="#faq" className="transition-colors hover:text-muted-foreground">
              {t('landing.nav.faq')}
            </a>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <a href={REPO_URL} aria-label={t('landing.nav.code')} className="grid size-10 place-items-center rounded-full transition-colors hover:bg-canvas-edge">
            <GithubLogoIcon aria-hidden="true" className="size-5" />
          </a>
          <Link href={APP_PATH} className="inline-flex h-10 items-center rounded-full border border-foreground/15 bg-background px-4 text-sm font-medium transition-colors hover:border-foreground/40">
            {t('landing.open')}
          </Link>
        </div>
      </nav>
    </header>
  )
}
