import { useSyncExternalStore, type RefObject } from 'react'

function onFullscreenChange(listener: () => void) {
  document.addEventListener('fullscreenchange', listener)
  return () => document.removeEventListener('fullscreenchange', listener)
}

export function useFullscreen(element: RefObject<HTMLElement | null>) {
  const supported = useSyncExternalStore(onFullscreenChange, () => document.fullscreenEnabled, () => false)
  const active = useSyncExternalStore(onFullscreenChange, () => document.fullscreenElement !== null, () => false)
  const toggle = () => void (active ? document.exitFullscreen() : element.current?.requestFullscreen())
  return { supported, active, toggle }
}
