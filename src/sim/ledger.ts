// The simulated bank feed of Studio Vela, a small design studio. Every day's transactions are generated from
// a seed made of the date, so the history is stable across reloads and the same for every visitor.
import { addMonths, day, isWeekday, key, monthName, monthStart, parts, quarterStart, shortDate, weekStart, type Day } from './dates'
import { between, pick, rng, round } from './rng'

export const CATEGORIES = ['Payroll', 'Rent & utilities', 'Contractors', 'Software', 'Marketing', 'Travel', 'Supplies', 'Other'] as const
export type Category = 'Income' | 'Transfer' | (typeof CATEGORIES)[number]
export type Method = 'Bank transfer' | 'Direct debit' | 'Business card'
export type Account = 'main' | 'reserve'

export interface Txn {
  id: string
  day: Day
  name: string
  amount: number // + money in, − money out
  category: Category
  method: Method
  account: Account
}

export const CLIENTS = [
  'Atlas Studio', 'Nordlicht GmbH', 'Marlow & Finch', 'Okafor Design', 'Brightwater Café',
  'Harbor & Pine', 'Kestrel Labs', 'Ostrava Films', 'Lumen Health', 'Maple Row Books',
] as const

const CARD: { name: string; category: Category; lo: number; hi: number }[] = [
  { name: 'Train to Porto', category: 'Travel', lo: 38, hi: 92 },
  { name: 'Taxi', category: 'Travel', lo: 12, hi: 34 },
  { name: 'Hotel, client visit', category: 'Travel', lo: 140, hi: 320 },
  { name: 'Office supplies', category: 'Supplies', lo: 24, hi: 140 },
  { name: 'Printing', category: 'Supplies', lo: 40, hi: 210 },
  { name: 'Courier', category: 'Other', lo: 14, hi: 48 },
  { name: 'Client lunch', category: 'Other', lo: 42, hi: 128 },
  { name: 'Stock photos', category: 'Software', lo: 29, hi: 99 },
]
const FREELANCERS = ['Inês Prado (motion)', 'Tomás Reis (dev)', 'Ana Duarte (copy)', 'Leo Brandt (3D)']

// The studio grew about 10% a year; older years are scaled down.
const growth = (d: Day, today: Day) => Math.max(0.4, 1 - 0.1 * ((today - d) / 365))

export function dayTxns(d: Day, today: Day): Txn[] {
  const r = rng(`clearbook:${key(d)}`)
  const g = growth(d, today)
  const { d: dom } = parts(d)
  const out: Txn[] = []
  const add = (name: string, amount: number, category: Category, method: Method) =>
    out.push({ id: `${key(d)}:${out.length}`, day: d, name, amount: round(amount), category, method, account: 'main' })

  if (dom === 1) add('Office rent', -3200, 'Rent & utilities', 'Direct debit')
  if (dom === 5) add('Electricity & water', -between(r, 180, 260), 'Rent & utilities', 'Direct debit')
  if (dom === 10) add('Social Security', -round(4800 * g, 10), 'Payroll', 'Direct debit')
  if (dom === 25) add('Salaries', -round(22000 * g, 10), 'Payroll', 'Bank transfer')
  if (dom === 3) add('Design tools', -round(540 * g, 1), 'Software', 'Business card')
  if (dom === 12) add('Cloud hosting', -between(r, 280, 340), 'Software', 'Business card')
  if (dom === 18) add('Accounting software', -49, 'Software', 'Business card')
  if (dom === 21) add('Workspace suite', -186, 'Software', 'Business card')
  if (dom === 8) add('Ad campaign', -between(r, 900, 1600) * g, 'Marketing', 'Business card')
  if (dom === 22) add('Content production', -between(r, 800, 1400) * g, 'Marketing', 'Bank transfer')
  if ((dom === 14 || dom === 28) && r() < 0.9) add(pick(r, FREELANCERS), -between(r, 2000, 5200) * g, 'Contractors', 'Bank transfer')

  if (isWeekday(d)) {
    if (r() < 0.5) add(pick(r, CLIENTS), round(between(r, 1500, 10000) * g, 10), 'Income', 'Bank transfer')
    if (r() < 0.5) { const c = pick(r, CARD); add(c.name, -between(r, c.lo, c.hi), c.category, 'Business card') }
  }
  return out
}

let cache: { today: Day; txns: Txn[] } | null = null

/** Generated history from January 1, six years ago, to today (inclusive), oldest first. */
export function history(today: Day): Txn[] {
  if (cache?.today === today) return cache.txns
  const txns: Txn[] = []
  for (let d = day(parts(today).y - 6, 0, 1); d <= today; d++) txns.push(...dayTxns(d, today))
  cache = { today, txns }
  return txns
}

export const isIncome = (t: Txn) => t.category === 'Income'
export const isExpense = (t: Txn) => t.amount < 0 && t.category !== 'Transfer'

export interface Totals { in: number; out: number; net: number }
export function totals(txns: Txn[], from: Day, to: Day): Totals {
  let i = 0
  let o = 0
  for (const t of txns) {
    if (t.account !== 'main' || t.day < from || t.day > to) continue
    if (isIncome(t)) i += t.amount
    else if (isExpense(t)) o -= t.amount
  }
  return { in: round(i), out: round(o), net: round(i - o) }
}

export type Period = 'week' | 'month' | 'year'
export interface Bucket extends Totals { label: string; from: Day; to: Day; current: boolean }

/** The last `count` weeks, months, or years, oldest first; the last one is the current, partial period. */
export function buckets(txns: Txn[], today: Day, period: Period, count = 7): Bucket[] {
  const out: Bucket[] = []
  for (let i = count - 1; i >= 0; i--) {
    let from: Day
    let to: Day
    let label: string
    if (period === 'week') {
      from = weekStart(today) - 7 * i
      to = from + 6
      label = shortDate(from)
    } else if (period === 'month') {
      from = addMonths(monthStart(today), -i)
      to = addMonths(from, 1) - 1
      label = monthName(from)
    } else {
      const y = parts(today).y - i
      from = day(y, 0, 1)
      to = day(y + 1, 0, 1) - 1
      label = String(y)
    }
    out.push({ ...totals(txns, from, Math.min(to, today)), label, from, to, current: i === 0 })
  }
  return out
}

export function spendingByCategory(txns: Txn[], from: Day, to: Day, top = 4) {
  const sums = new Map<Category, number>()
  for (const t of txns) if (t.account === 'main' && isExpense(t) && t.day >= from && t.day <= to) sums.set(t.category, (sums.get(t.category) ?? 0) - t.amount)
  const total = [...sums.values()].reduce((a, b) => a + b, 0)
  // "Other" always goes last, together with the smaller categories.
  const sorted = [...sums.entries()].filter(([c]) => c !== 'Other').sort((a, b) => b[1] - a[1])
  const rows: { category: string; amount: number; share: number }[] = sorted.slice(0, top).map(([category, amount]) => ({ category, amount: round(amount), share: total ? amount / total : 0 }))
  const rest = sorted.slice(top).reduce((a, [, v]) => a + v, 0) + (sums.get('Other') ?? 0)
  if (rest > 0) rows.push({ category: 'Other', amount: round(rest), share: rest / total })
  return { total: round(total), rows }
}

/** Expenses booked against the quarterly operating budget. */
export const quarterSpent = (txns: Txn[], today: Day) => totals(txns, quarterStart(today), today).out
