'use client'

import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { searchPlaces } from '@/geocode/client'
import { MIN_QUERY_LENGTH, normaliseQuery, type Place } from '@/geocode/schema'
import { t } from '@/text/messages'
import { cn } from '@/ui/cn'
import { Input } from '@/ui/input'
import { PanelSection } from '@/ui/section'
import type { RegionId } from '@/solve'
import { useEditorStore, useRegion } from './plot-store'

const TYPING_PAUSE_MS = 250

type SearchState =
  | { status: 'idle' }
  | { status: 'searching'; places: readonly Place[] }
  | { status: 'found'; places: readonly Place[] }
  | { status: 'failed' }

const placesOf = (search: SearchState) => (search.status === 'found' || search.status === 'searching' ? search.places : [])

function useLiveSearch(query: string, region: RegionId) {
  const [search, setSearch] = useState<SearchState>({ status: 'idle' })
  const normalised = normaliseQuery(query)
  const [settled, setSettled] = useState(normalised)
  const ready = normalised.length >= MIN_QUERY_LENGTH

  if (settled !== normalised) {
    setSettled(normalised)
    setSearch((current) => (ready ? { status: 'searching', places: placesOf(current) } : { status: 'idle' }))
  }

  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchPlaces(normalised, region, { signal: controller.signal })
        .then((places) => setSearch({ status: 'found', places }))
        .catch(() => {
          if (!controller.signal.aborted) setSearch({ status: 'failed' })
        })
    }, TYPING_PAUSE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [normalised, ready, region])

  return { search, close: () => setSearch({ status: 'idle' }) }
}

function statusText(search: SearchState) {
  if (search.status === 'failed') return t('search.failed')
  if (search.status === 'searching') return search.places.length === 0 ? t('search.searching') : null
  if (search.status === 'found' && search.places.length === 0) return t('search.none')
  return null
}

export function PlaceSearch() {
  const store = useEditorStore()
  const id = useId()
  const listId = `${id}-list`
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const region = useRegion()
  const { search, close } = useLiveSearch(query === picked ? '' : query, region.id)
  const places = placesOf(search)
  const open = places.length > 0
  const highlighted = Math.min(active, places.length - 1)

  const pick = (place: Place) => {
    store.dispatch({ type: 'focus', at: place.lngLat })
    setQuery(place.label)
    setPicked(place.label)
    close()
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (open) pick(places[highlighted])
  }
  const move = (event: KeyboardEvent) => {
    if (!open) return
    if (event.key === 'Escape') close()
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    setActive((highlighted + step + places.length) % places.length)
  }
  const type = (text: string) => {
    setQuery(text)
    setActive(0)
  }

  return (
    <PanelSection title={t('search.title')}>
      <form role="search" onSubmit={submit}>
        <label htmlFor={id} className="sr-only">
          {region.country ? t('search.label', { country: region.country }) : t('search.label.anywhere')}
        </label>
        <div className="relative">
          <MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={id}
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open ? `${listId}-${highlighted}` : undefined}
            autoComplete="off"
            enterKeyHint="search"
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(e) => type(e.target.value)}
            onKeyDown={move}
            className="pl-9 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {search.status === 'searching' && (
            <span
              aria-hidden="true"
              className="absolute top-1/2 right-9 size-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
            />
          )}
        </div>
      </form>
      <p aria-live="polite" className="mt-2 text-xs leading-relaxed text-muted-foreground empty:hidden">
        {statusText(search)}
      </p>
      <ul
        id={listId}
        role="listbox"
        aria-label={t('search.results')}
        className={cn(
          'mt-1 overflow-hidden rounded-md border bg-background shadow-sm transition-opacity',
          open ? 'animate-enter' : 'hidden',
          search.status === 'searching' && 'opacity-60',
        )}
      >
        {places.map((place, index) => (
          <li
            key={place.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === highlighted}
            onPointerDown={(event) => event.preventDefault()}
            onPointerMove={() => setActive(index)}
            onClick={() => pick(place)}
            className="flex min-h-11 cursor-pointer items-center px-3 py-2 text-sm leading-snug aria-selected:bg-muted lg:min-h-9"
          >
            {place.label}
          </li>
        ))}
      </ul>
    </PanelSection>
  )
}
