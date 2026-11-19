import { useState } from 'react'

export function useSettled<T>(value: T, differs: (kept: T, next: T) => boolean): T {
  const [kept, setKept] = useState(value)
  const replace = kept !== value && differs(kept, value)
  if (replace) setKept(value)
  return replace ? value : kept
}
