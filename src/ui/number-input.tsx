'use client'

import type { ChangeEvent, ComponentProps } from 'react'
import { groupTyped } from '@/text/typed-number'
import { Input } from './input'

type NumberInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'inputMode'> & {
  readonly value: string
  readonly onText: (text: string) => void
}

export function NumberInput({ value, onText, ...props }: NumberInputProps) {
  function change({ target }: ChangeEvent<HTMLInputElement>) {
    const typed = groupTyped(value, target.value, target.selectionStart ?? target.value.length)
    target.value = typed.text
    target.setSelectionRange(typed.caret, typed.caret)
    onText(typed.text)
  }

  return <Input inputMode="decimal" autoComplete="off" value={value} onChange={change} {...props} />
}
