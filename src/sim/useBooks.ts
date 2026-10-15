import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { fromDate } from './dates'
import { allTxns, balances, budget, freshBooks, invoices, kpis, receivables, reduce, vat, type Action, type Books } from './books'

const KEY = 'clearbook:v1'
export const TICK_MS = 3000

function load(): Books {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Books
  } catch {
    // Private mode or blocked storage: start fresh.
  }
  return freshBooks(Date.now())
}

export function useBooks() {
  const [now, setNow] = useState(() => new Date())
  const today = fromDate(now)
  const [books, dispatch] = useReducer((b: Books, a: Action) => {
    const t = new Date()
    return reduce(b, a, { today: fromDate(t), now: t.getTime() })
  }, undefined, load)

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date())
      dispatch({ type: 'tick', random: Math.random() })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(books))
    } catch {
      // Storage full or blocked: the demo still works, it just won't remember.
    }
  }, [books])

  const view = useMemo(() => {
    const txns = allTxns(books, today)
    const list = invoices(books, today)
    const bal = balances(books)
    return { txns, invoices: list, balances: bal, kpis: kpis(txns, today), budget: budget(txns, today), vat: vat(today, bal.reserve), receivables: receivables(list, txns, today) }
  }, [books, today])

  const act = useCallback((a: Action) => dispatch(a), [])
  return { books, now, today, ...view, act }
}

export type BooksApi = ReturnType<typeof useBooks>
