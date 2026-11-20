import { GithubLogoIcon } from '@phosphor-icons/react/ssr'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { REGION } from '@/region/regions'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { Logo } from '@/ui/logo'
import { EXAMPLE_LINK, exampleFigures } from './example'
import { FaqItem } from './faq'
import { FeatureCards } from './feature-cards'
import { LegacyLinkForward } from './legacy-link-forward'
import { PillLink } from './pill-link'
import shot from './app.png'

const APP = '/app'
const REPO = 'https://github.com/kunalgoesbyken/plotwise'
const STEPS = ['plot', 'roads', 'results'] as const
const QUESTIONS = ['sources', 'money', 'share', 'region'] as const

function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-foreground/5 bg-canvas/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Logo className="size-6" />
          {t('app.name')}
        </Link>
        <div className="hidden gap-6 text-sm md:flex">
          <a href="#how" className="transition-colors hover:text-muted-foreground">
            {t('landing.nav.how')}
          </a>
          <a href="#faq" className="transition-colors hover:text-muted-foreground">
            {t('landing.nav.faq')}
          </a>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a href={REPO} aria-label={t('landing.nav.code')} className="grid size-10 place-items-center rounded-full transition-colors hover:bg-canvas-edge">
            <GithubLogoIcon aria-hidden="true" className="size-5" />
          </a>
          <Link href={APP} className="inline-flex h-10 items-center rounded-full border border-foreground/15 bg-background px-4 text-sm font-medium transition-colors hover:border-foreground/40">
            {t('landing.open')}
          </Link>
        </div>
      </nav>
    </header>
  )
}

function Section({ id, title, lede, children }: { id?: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 sm:py-28">
      <div className="reveal mx-auto mb-12 max-w-2xl text-center">
        <h2 className="text-heading font-medium text-balance">{title}</h2>
        {lede && <p className="mt-4 text-lg leading-relaxed text-pretty text-muted-foreground">{lede}</p>}
      </div>
      {children}
    </section>
  )
}

function Hero({ plotSqm, allowedSqm }: { plotSqm: number; allowedSqm: number }) {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24">
      <div className="mx-auto flex max-w-4xl animate-enter flex-col items-center text-center">
        <h1 className="text-display font-medium text-balance">{t('landing.hero.title')}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">{t('landing.hero.lede', { city: REGION.city })}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <PillLink href={EXAMPLE_LINK}>{t('landing.hero.example')}</PillLink>
          <PillLink href={APP} quiet>
            {t('landing.hero.draw')}
          </PillLink>
        </div>
      </div>
      <figure className="mt-16 animate-enter rounded-frame bg-canvas-edge p-2 [animation-delay:150ms] sm:mt-20">
        <div className="overflow-hidden rounded-frame-inner bg-background shadow-sm">
          <figcaption className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b px-5 py-3.5 text-sm">
            <span className="text-muted-foreground">
              {REGION.city} <span className="px-1 text-border">/</span> <span className="text-foreground">{t('landing.frame.place')}</span>
            </span>
            <span className="text-muted-foreground">
              {t('landing.frame.meta', { area: formatQuantity(plotSqm, 'sqm'), allowed: formatQuantity(allowedSqm, 'sqm') })}
            </span>
          </figcaption>
          <Link href={EXAMPLE_LINK} className="block">
            <Image src={shot} alt={t('landing.frame.alt')} priority sizes="(min-width: 72rem) 70rem, 100vw" className="h-auto w-full" />
          </Link>
        </div>
      </figure>
    </section>
  )
}

function Steps() {
  return (
    <ol className="grid gap-2 rounded-frame bg-canvas-edge p-2 md:grid-cols-3">
      {STEPS.map((step, index) => (
        <li key={step} className="reveal flex flex-col gap-3 rounded-frame-inner bg-background p-6 sm:p-7">
          <span className="text-sm text-muted-foreground tabular-nums">{String(index + 1).padStart(2, '0')}</span>
          <h3 className="text-lg font-medium tracking-tight">{t(`landing.how.${step}.title`)}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{t(`landing.how.${step}.body`)}</p>
        </li>
      ))}
    </ol>
  )
}

function Scope() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-10 text-center sm:px-8">
      <p className="reveal text-xl leading-relaxed text-pretty sm:text-2xl">
        <span className="font-medium">{t('landing.scope.title')}.</span>{' '}
        <span className="text-muted-foreground">{t('landing.scope.body', { zone: REGION.zone.name, city: REGION.city, authority: REGION.authority })}</span>
      </p>
    </section>
  )
}

function Faq() {
  return (
    <section id="faq" className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[2fr_3fr]">
      <h2 className="reveal text-heading font-medium">{t('landing.faq.title')}</h2>
      <div className="reveal flex flex-col gap-2 rounded-frame bg-canvas-edge p-2">
        {QUESTIONS.map((id) => (
          <FaqItem key={id} question={t(`landing.faq.${id}.q`)} answer={t(`landing.faq.${id}.a`)} />
        ))}
      </div>
    </section>
  )
}

function Closing() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-5 pb-24 text-center sm:px-8">
      <h2 className="reveal text-heading font-medium text-balance">{t('landing.hero.title')}</h2>
      <PillLink href={EXAMPLE_LINK}>{t('landing.hero.example')}</PillLink>
    </section>
  )
}

function Footer() {
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

export function LandingPage() {
  const figures = exampleFigures()
  return (
    <div className="min-h-dvh bg-canvas text-foreground">
      <LegacyLinkForward />
      <Nav />
      <main>
        <Hero plotSqm={figures.plotSqm} allowedSqm={figures.allowedSqm} />
        <Section id="how" title={t('landing.how.title')} lede={t('landing.how.lede')}>
          <Steps />
        </Section>
        <Section title={t('landing.features.title')} lede={t('landing.features.lede')}>
          <FeatureCards figures={figures} />
        </Section>
        <Scope />
        <Faq />
        <Closing />
      </main>
      <Footer />
    </div>
  )
}
