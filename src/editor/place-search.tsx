'use client'

import { Search } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { searchPlaces } from '@/geocode/client'
import { MIN_QUERY_LENGTH, normaliseQuery, type Place } from '@/geocode/schema'
import { t } from '@/text/messages'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { PanelSection } from '@/ui/section'
import { useEditorStore } from './plot-store'

type SearchState = { status: 'idle' } | { status: 'searching' } | { status: 'found'; places: readonly Place[] } | { status: 'failed' }

function useSearch() {
  const [search, setSearch] = useState<SearchState>({ status: 'idle' })
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])

  const run = (query: string) => {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setSearch({ status: 'searching' })
    searchPlaces(query, { signal: controller.signal })
      .then((places) => setSearch({ status: 'found', places }))
      .catch(() => {
        if (!controller.signal.aborted) setSearch({ status: 'failed' })
      })
  }
  const reset = () => setSearch({ status: 'idle' })
  return { search, run, reset }
}

function StatusLine({ search }: { search: SearchState }) {
  if (search.status === 'searching') return t('search.searching')
  if (search.status === 'failed') return t('search.failed')
  if (search.status === 'found' && search.places.length === 0) return t('search.none')
  return null
}

function PlaceList({ places, onPick }: { places: readonly Place[]; onPick: (place: Place) => void }) {
  return (
    <ul aria-label={t('search.results')} className="mt-2 divide-y border-y">
      {places.map((place) => (
        <li key={place.id}>
          <button
            type="button"
            onClick={() => onPick(place)}
            className="flex min-h-11 w-full items-center px-3 py-2 text-left text-sm leading-snug transition-colors hover:bg-muted"
          >
            {place.label}
          </button>
        </li>
      ))}
    </ul>
  )
}

export function PlaceSearch() {
  const store = useEditorStore()
  const id = useId()
  const [query, setQuery] = useState('')
  const { search, run, reset } = useSearch()
  const tooShort = normaliseQuery(query).length < MIN_QUERY_LENGTH

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!tooShort) run(query)
  }
  const pick = (place: Place) => {
    store.dispatch({ type: 'focus', at: place.lngLat })
    setQuery(place.label)
    reset()
  }

  return (
    <PanelSection title={t('search.title')}>
      <form role="search" onSubmit={submit} className="flex gap-2">
        <label htmlFor={id} className="sr-only">
          {t('search.label')}
        </label>
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={id}
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline" disabled={tooShort || search.status === 'searching'}>
          {t('search.submit')}
        </Button>
      </form>
      <p aria-live="polite" className="mt-2 text-xs leading-relaxed text-muted-foreground empty:hidden">
        <StatusLine search={search} />
      </p>
      {search.status === 'found' && search.places.length > 0 && <PlaceList places={search.places} onPick={pick} />}
    </PanelSection>
  )
}
