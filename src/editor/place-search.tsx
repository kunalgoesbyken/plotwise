'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { searchPlaces } from '@/geocode/client'
import { MIN_QUERY_LENGTH, normaliseQuery, type Place } from '@/geocode/schema'
import { t } from '@/text/messages'
import { useEditorStore } from './plot-store'
import { Button, PanelSection } from './ui'

type Search = { status: 'idle' } | { status: 'searching' } | { status: 'found'; places: readonly Place[] } | { status: 'failed' }

function useSearch() {
  const [search, setSearch] = useState<Search>({ status: 'idle' })
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

function StatusLine({ search }: { search: Search }) {
  if (search.status === 'searching') return t('search.searching')
  if (search.status === 'failed') return t('search.failed')
  if (search.status === 'found' && search.places.length === 0) return t('search.none')
  return null
}

function PlaceList({ places, onPick }: { places: readonly Place[]; onPick: (place: Place) => void }) {
  return (
    <ul aria-label={t('search.results')} className="mt-2 divide-y divide-rule overflow-hidden rounded-md border border-rule">
      {places.map((place) => (
        <li key={place.id}>
          <button
            type="button"
            onClick={() => onPick(place)}
            className="flex min-h-11 w-full flex-col justify-center px-3 py-2 text-left transition-colors duration-150 hover:bg-vellum/60"
          >
            <span className="text-sm leading-snug">{place.label}</span>
            {place.labelTh && (
              <span lang="th" className="text-xs leading-snug text-slate">
                {place.labelTh}
              </span>
            )}
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
        <input
          id={id}
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-md border border-rule bg-paper px-3 text-sm transition-colors duration-150 placeholder:text-slate hover:border-slate focus-visible:border-plot lg:h-9"
        />
        <Button type="submit" disabled={tooShort || search.status === 'searching'}>
          {t('search.submit')}
        </Button>
      </form>
      <p aria-live="polite" className="mt-2 text-xs leading-relaxed text-slate empty:hidden">
        <StatusLine search={search} />
      </p>
      {search.status === 'found' && search.places.length > 0 && <PlaceList places={search.places} onPick={pick} />}
    </PanelSection>
  )
}
