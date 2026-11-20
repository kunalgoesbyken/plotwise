import type { ReactNode } from 'react'
import { encodeRegion } from '@/editor/plot-url'
import { DEFAULT_REGION } from '@/region/regions'
import { formatList, formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { EXAMPLE_LINK, exampleFigures } from './example'
import { FaqItem } from './faq'
import { Footer } from './footer'
import { HeroMedia } from './hero-media'
import { LegacyLinkForward } from './legacy-link-forward'
import { APP_PATH } from './links'
import { Nav } from './nav'
import { OTHER_REGIONS, OTHER_RULES } from './other-regions'
import { PillLink } from './pill-link'
import { Proof } from './proof'

const STEPS = ['plot', 'roads', 'results'] as const
const CITY = DEFAULT_REGION.name
const ELSEWHERE = formatList(OTHER_RULES)

const QUESTIONS = [
  { id: 'sources', question: t('landing.faq.sources.q'), answer: t('landing.faq.sources.a') },
  { id: 'money', question: t('landing.faq.money.q'), answer: t('landing.faq.money.a') },
  { id: 'share', question: t('landing.faq.share.q'), answer: t('landing.faq.share.a') },
  { id: 'region', question: t('landing.faq.region.q', { city: CITY }), answer: t('landing.faq.region.a', { city: CITY, elsewhere: ELSEWHERE }) },
] as const

function Section({ id, title, lede, children }: { id?: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[2fr_3fr] lg:gap-16">
      <div className="reveal">
        <h2 className="text-heading font-medium text-balance">{title}</h2>
        {lede && <p className="mt-4 text-lg leading-relaxed text-pretty text-muted-foreground">{lede}</p>}
      </div>
      <div>{children}</div>
    </section>
  )
}

function Hero({ plotSqm, allowedSqm }: { plotSqm: number; allowedSqm: number }) {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24">
      <div className="mx-auto flex max-w-4xl animate-enter flex-col items-center text-center">
        <h1 className="text-display font-medium text-balance">{t('landing.hero.title')}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">{t('landing.hero.lede', { city: CITY, elsewhere: ELSEWHERE })}</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <PillLink href={EXAMPLE_LINK}>{t('landing.hero.example')}</PillLink>
          <PillLink href={APP_PATH} quiet>
            {t('landing.hero.draw')}
          </PillLink>
        </div>
      </div>
      <figure className="mt-16 animate-enter rounded-frame bg-canvas-edge p-2 [animation-delay:150ms] max-sm:mx-auto max-sm:max-w-sm sm:mt-20">
        <div className="overflow-hidden rounded-frame-inner bg-background shadow-sm">
          <figcaption className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b px-5 py-3.5 text-sm">
            <span className="text-muted-foreground">
              {DEFAULT_REGION.name} <span className="px-1 text-border">/</span> <span className="text-foreground">{t('landing.frame.place')}</span>
            </span>
            <span className="text-muted-foreground">
              {t('landing.frame.meta', { area: formatQuantity(plotSqm, 'sqm'), allowed: formatQuantity(allowedSqm, 'sqm') })}
            </span>
          </figcaption>
          <HeroMedia alt={t('landing.frame.alt')} />
        </div>
      </figure>
    </section>
  )
}

function Steps() {
  return (
    <ol className="divide-y border-y">
      {STEPS.map((step, index) => (
        <li key={step} className="reveal grid grid-cols-[3rem_1fr] gap-4 py-8">
          <span className="pt-1 text-sm text-muted-foreground tabular-nums">{String(index + 1).padStart(2, '0')}</span>
          <div>
            <h3 className="text-lg font-medium tracking-tight">{t(`landing.how.${step}.title`)}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`landing.how.${step}.body`)}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function Scope() {
  return (
    <div className="reveal mt-8 flex flex-col gap-5">
      <p className="text-sm leading-relaxed text-pretty">
        <span className="font-medium">{t('landing.scope.title')}.</span>{' '}
        <span className="text-muted-foreground">
          {t('landing.scope.body', { zone: DEFAULT_REGION.zone.name, city: CITY, authority: DEFAULT_REGION.authority, elsewhere: ELSEWHERE })}
        </span>
      </p>
      <div className="flex flex-wrap gap-3">
        {OTHER_REGIONS.map(({ region, link }) => (
          <PillLink key={region.id} href={`${APP_PATH}#${encodeRegion(region.id)}`} quiet>
            {link}
          </PillLink>
        ))}
      </div>
    </div>
  )
}

function Faq() {
  return (
    <Section id="faq" title={t('landing.faq.title')}>
      <div className="divide-y border-y">
        {QUESTIONS.map(({ id, question, answer }) => (
          <FaqItem key={id} question={question} answer={answer} />
        ))}
      </div>
    </Section>
  )
}

export function LandingPage() {
  const figures = exampleFigures()
  return (
    <div className="min-h-dvh bg-canvas text-foreground">
      <LegacyLinkForward />
      <Nav sections />
      <main>
        <Hero plotSqm={figures.plotSqm} allowedSqm={figures.allowedSqm} />
        <Section id="how" title={t('landing.how.title')} lede={t('landing.how.lede')}>
          <Steps />
        </Section>
        <Section title={t('landing.features.title')} lede={t('landing.features.lede')}>
          <Proof figures={figures} />
          <Scope />
        </Section>
        <Faq />
      </main>
      <Footer />
    </div>
  )
}
