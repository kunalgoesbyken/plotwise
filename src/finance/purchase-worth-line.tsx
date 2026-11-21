'use client'

import { useMemo } from 'react'
import { purchaseWorthText } from './figures'
import { useFinance } from './use-finance'

export function PurchaseWorthLine() {
  const finance = useFinance()
  const worth = useMemo(() => finance?.worthOfBuying() ?? null, [finance])
  if (!finance || !worth) return null
  return <p className="text-sm leading-snug font-medium">{purchaseWorthText(worth, finance.region.currency)}</p>
}
