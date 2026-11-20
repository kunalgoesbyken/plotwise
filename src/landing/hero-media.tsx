'use client'

import { PauseIcon, PlayIcon } from '@phosphor-icons/react'
import { getImageProps } from 'next/image'
import { useRef, useState, useSyncExternalStore } from 'react'
import { t } from '@/text/messages'
import { Button } from '@/ui/button'
import desktopPoster from './app.png'
import phonePoster from './app-phone.png'

const PHONE_QUERY = '(width < 40rem)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const DESKTOP_SIZES = '(min-width: 72rem) 70rem, 100vw'
const PHONE_SIZES = '100vw'

const CLIPS = {
  desktop: { webm: '/hero/hero-desktop.webm', mp4: '/hero/hero-desktop.mp4' },
  phone: { webm: '/hero/hero-phone.webm', mp4: '/hero/hero-phone.mp4' },
} as const

type Presentation = 'still' | keyof typeof CLIPS

function subscribe(onChange: () => void) {
  const queries = [matchMedia(PHONE_QUERY), matchMedia(REDUCED_MOTION_QUERY)]
  queries.forEach((query) => query.addEventListener('change', onChange))
  return () => queries.forEach((query) => query.removeEventListener('change', onChange))
}

function presentation(): Presentation {
  if (matchMedia(REDUCED_MOTION_QUERY).matches) return 'still'
  return matchMedia(PHONE_QUERY).matches ? 'phone' : 'desktop'
}

const usePresentation = () => useSyncExternalStore<Presentation>(subscribe, presentation, () => 'still')

function Clip({ clip, poster, label }: { clip: keyof typeof CLIPS; poster: string; label: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const toggle = () => (video.current?.paused ? video.current.play() : video.current?.pause())
  return (
    <>
      <video
        ref={video}
        key={clip}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={poster}
        aria-label={label}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="absolute inset-0 size-full object-cover"
      >
        <source src={CLIPS[clip].webm} type="video/webm; codecs=vp9" />
        <source src={CLIPS[clip].mp4} type="video/mp4" />
      </video>
      <Button variant="outline" size="icon" aria-label={t(playing ? 'landing.demo.pause' : 'landing.demo.play')} onClick={toggle} className="absolute right-3 bottom-3 shadow-sm">
        {playing ? <PauseIcon aria-hidden="true" weight="fill" /> : <PlayIcon aria-hidden="true" weight="fill" />}
      </Button>
    </>
  )
}

export function HeroMedia({ alt }: { alt: string }) {
  const mode = usePresentation()
  const desktop = getImageProps({ src: desktopPoster, alt, priority: true, sizes: DESKTOP_SIZES }).props
  const phone = getImageProps({ src: phonePoster, alt: '', sizes: PHONE_SIZES }).props
  return (
    <div className="relative aspect-375/812 bg-background sm:aspect-16/10">
      <picture>
        <source media={PHONE_QUERY} srcSet={phone.srcSet} sizes={phone.sizes} />
        <img {...desktop} alt={alt} className="size-full object-cover" />
      </picture>
      {mode !== 'still' && <Clip clip={mode} poster={mode === 'phone' ? phone.src : desktop.src} label={alt} />}
    </div>
  )
}
