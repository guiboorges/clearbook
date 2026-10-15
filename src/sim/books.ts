// Studio Vela's books: seeded invoices, VAT, budget, and every action the demo allows. Pure functions only;
// useBooks.ts owns the state, the clock, and localStorage.
import { addMonths, day, monthStart, parts, quarterOf, quarterStart, shortDate, type Day } from './dates'
import { history, isExpense, quarterSpent, totals, type Category, type Method, type Txn } from './ledger'
import { between, pick, rng, round } from './rng'

export const OPENING_MAIN = 42180.55
export const OPENING_RESERVE = 6600

// ---------- invoices ----------
export type InvoiceStatus = 'draft' | 'sent' | 'pending' | 'overdue' | 'paid'
export interface Invoice {
  no: number
  client: string
  amount: number
  issued: Day
  due: Day
  sent: boolean
  paidOn?: Day
}

// Invoices of the current month and the two before it, placed relative to the first of the month,
// so their statuses move naturally as the month goes on.
const SPECS: { issued: number; terms: number; client: string; lo: number; hi: number; paid?: number }[] = [
  { issued: -40, terms: 30, client: 'Brightwater Café', lo: 2400, hi: 3600 },
  { issued: -25, terms: 30, client: 'Nordlicht GmbH', lo: 2200, hi: 3400 },
  { issued: -20, terms: 30, client: 'Marlow & Finch', lo: 5200, hi: 7600, paid: 11 },
  { issued: -12, terms: 45, client: 'Harbor & Pine', lo: 4200, hi: 6400 },
  { issued: 2, terms: 30, client: 'Atlas Studio', lo: 3400, hi: 5200 },
  { issued: 8, terms: 21, client: 'Okafor Design', lo: 1400, hi: 2400 },
]

export function seededInvoices(today: Day): Invoice[] {
  const m = monthStart(today)
  const r = rng(`invoices:${m}`)
  const base = 100 + ((parts(m).y - 2024) * 12 + parts(m).m) * 6
  return SPECS.map((s, i) => {
    const issued = m + s.issued
    const paidOn = s.paid !== undefined ? m + s.paid : undefined
    return { no: base + i, client: s.client, amount: round(between(r, s.lo, s.hi), 10), issued, due: issued + s.terms, sent: true, paidOn }
  }).filter(inv => inv.issued <= today)
}

export function invoiceStatus(inv: Invoice, today: Day): InvoiceStatus {
  if (inv.paidOn !== undefined && inv.paidOn <= today) return 'paid'
  if (!inv.sent) return 'draft'
  if (inv.due < today) return 'overdue'
  if (inv.due - today <= 7) return 'pending'
  return 'sent'
}

export const invoiceNo = (no: number) => `INV-${String(no).padStart(4, '0')}`
const ORDER: Record<InvoiceStatus, number> = { overdue: 0, pending: 1, sent: 2, draft: 3, paid: 4 }

// ---------- state ----------
export interface BookEvent {
  id: number
  at: number
  text: string
  detail?: string
  tone?: 'positive' | 'negative' | 'warning' | 'neutral'
}

export interface Books {
  userTxns: Txn[]
  paid: Record<number, Day>
  created: Invoice[]
  reminded: Record<number, Day>
  lastSync: number
  alerts: boolean
  events: BookEvent[]
  unread: number
}

export function freshBooks(now: number): Books {
  return {
    userTxns: [],
    paid: {},
    created: [],
    reminded: {},
    lastSync: now - 2 * 60_000,
    alerts: true,
    events: [
      { id: 3, at: now - 2 * 60_000, text: 'Accounts synced', detail: 'Main account and Tax reserve', tone: 'neutral' },
      { id: 2, at: now - 50 * 60_000, text: 'Invoice overdue', detail: 'Brightwater Café · reminder suggested', tone: 'negative' },
      { id: 1, at: now - 3 * 3600_000, text: 'Payroll scheduled', detail: 'Salaries on the 25th', tone: 'neutral' },
    ],
    unread: 2,
  }
}

// ---------- selectors ----------
export function allTxns(b: Books, today: Day): Txn[] {
  return [...history(today), ...b.userTxns].sort((x, y) => x.day - y.day)
}

export function invoices(b: Books, today: Day) {
  return [...seededInvoices(today), ...b.created]
    .map(inv => (b.paid[inv.no] !== undefined ? { ...inv, paidOn: b.paid[inv.no] } : inv))
    .map(inv => ({ ...inv, status: invoiceStatus(inv, today) }))
    .sort((x, y) => ORDER[x.status] - ORDER[y.status] || x.due - y.due)
}
export type InvoiceView = ReturnType<typeof invoices>[number]

export function receivables(list: InvoiceView[], txns: Txn[], today: Day) {
  const open = list.filter(i => i.status !== 'paid' && i.status !== 'draft')
  const overdue = list.filter(i => i.status === 'overdue')
  return {
    outstanding: round(open.reduce((a, i) => a + i.amount, 0)),
    overdue: round(overdue.reduce((a, i) => a + i.amount, 0)),
    overdueCount: overdue.length,
    oldestOverdueDays: overdue.length ? Math.max(...overdue.map(i => today - i.due)) : 0,
    collected: totals(txns, monthStart(today), today).in,
  }
}

export function balances(b: Books) {
  const sum = (acc: 'main' | 'reserve') => b.userTxns.filter(t => t.account === acc).reduce((a, t) => a + t.amount, 0)
  return { main: round(OPENING_MAIN + sum('main')), reserve: round(OPENING_RESERVE + sum('reserve')) }
}

const pct = (now: number, before: number) => (before ? (now - before) / Math.abs(before) : 0)

/** Month to date, compared with the same days of the previous month. */
export function kpis(txns: Txn[], today: Day) {
  const from = monthStart(today)
  const prevFrom = addMonths(from, -1)
  const span = today - from
  const prevTo = Math.min(prevFrom + span, from - 1)
  const cur = totals(txns, from, today)
  const prev = totals(txns, prevFrom, prevTo)
  return {
    revenue: cur.in, expenses: cur.out, net: cur.net,
    revenueDelta: pct(cur.in, prev.in), expensesDelta: pct(cur.out, prev.out), netDelta: pct(cur.net, prev.net),
    margin: cur.in ? cur.net / cur.in : 0,
    compareLabel: `vs ${shortDate(prevFrom)}–${parts(prevTo).d}`,
  }
}

export function budget(txns: Txn[], today: Day) {
  const qs = quarterStart(today)
  const amount = round(between(rng(`budget:${qs}`), 128000, 140000), 100)
  const spent = quarterSpent(txns, today)
  return { label: `Q${quarterOf(today) + 1} budget`, amount, spent, remaining: round(amount - spent), share: spent / amount }
}

/** Quarterly VAT is due on the 20th of the second month after the quarter ends. */
export function vat(today: Day, reserve: number) {
  const qs = quarterStart(today)
  let periodStart = addMonths(qs, -3)
  let due = day(parts(qs).y, parts(qs).m + 1, 20)
  if (today > due) {
    periodStart = qs
    due = day(parts(qs).y, parts(qs).m + 4, 20)
  }
  const amount = round(between(rng(`vat:${periodStart}`), 6800, 8400), 10)
  const covered = Math.min(reserve, amount)
  return {
    period: `Q${quarterOf(periodStart) + 1} ${parts(periodStart).y}`,
    due, daysLeft: due - today, amount, covered, share: covered / amount, shortfall: round(amount - covered),
  }
}

// ---------- actions ----------
export type Action =
  | { type: 'markPaid'; no: number }
  | { type: 'remind'; no: number }
  | { type: 'sendDraft'; no: number }
  | { type: 'createInvoice'; client: string; amount: number; terms: number; send: boolean }
  | { type: 'addExpense'; name: string; category: Category; amount: number; method: Method }
  | { type: 'setAside'; amount: number }
  | { type: 'reconcile' }
  | { type: 'alerts'; on: boolean }
  | { type: 'tick'; random: number }
  | { type: 'read' }
  | { type: 'reset' }

export interface Ctx { today: Day; now: number }

function log(b: Books, now: number, text: string, detail?: string, tone: BookEvent['tone'] = 'neutral'): Books {
  const ev = { id: (b.events[0]?.id ?? 0) + 1, at: now, text, detail, tone }
  return { ...b, events: [ev, ...b.events].slice(0, 40), unread: b.unread + 1 }
}

const txnId = (b: Books, now: number) => `u:${now}:${b.userTxns.length}`
const eur = (v: number) => `€${v.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function payInvoice(b: Books, inv: InvoiceView, c: Ctx, by: string): Books {
  const t: Txn = { id: txnId(b, c.now), day: c.today, name: inv.client, amount: inv.amount, category: 'Income', method: 'Bank transfer', account: 'main' }
  return log({ ...b, paid: { ...b.paid, [inv.no]: c.today }, userTxns: [...b.userTxns, t] }, c.now, `${inv.client} paid ${invoiceNo(inv.no)}`, `${eur(inv.amount)} · ${by}`, 'positive')
}

export function reduce(b: Books, a: Action, c: Ctx): Books {
  switch (a.type) {
    case 'markPaid': {
      const inv = invoices(b, c.today).find(i => i.no === a.no)
      if (!inv || inv.status === 'paid' || inv.status === 'draft') return b
      return payInvoice(b, inv, c, 'marked as paid')
    }
    case 'remind': {
      const inv = invoices(b, c.today).find(i => i.no === a.no)
      if (!inv) return b
      return log({ ...b, reminded: { ...b.reminded, [a.no]: c.today } }, c.now, `Reminder sent to ${inv.client}`, invoiceNo(a.no), 'neutral')
    }
    case 'sendDraft': {
      const inv = b.created.find(i => i.no === a.no)
      if (!inv || inv.sent) return b
      return log({ ...b, created: b.created.map(i => (i.no === a.no ? { ...i, sent: true, issued: c.today, due: c.today + (i.due - i.issued) } : i)) }, c.now, `${invoiceNo(a.no)} sent to ${inv.client}`, eur(inv.amount))
    }
    case 'createInvoice': {
      const no = Math.max(0, ...invoices(b, c.today).map(i => i.no)) + 1
      const inv: Invoice = { no, client: a.client, amount: round(a.amount), issued: c.today, due: c.today + a.terms, sent: a.send }
      return log({ ...b, created: [...b.created, inv] }, c.now, a.send ? `${invoiceNo(no)} sent to ${a.client}` : `Draft ${invoiceNo(no)} saved`, `${eur(inv.amount)} · due ${shortDate(inv.due)}`)
    }
    case 'addExpense': {
      const before = budget(allTxns(b, c.today), c.today)
      const t: Txn = { id: txnId(b, c.now), day: c.today, name: a.name, amount: -round(Math.abs(a.amount)), category: a.category, method: a.method, account: 'main' }
      let next = log({ ...b, userTxns: [...b.userTxns, t] }, c.now, `Expense added: ${a.name}`, `${eur(Math.abs(t.amount))} · ${a.category}`)
      const after = budget(allTxns(next, c.today), c.today)
      if (b.alerts && before.share < 0.9 && after.share >= 0.9) next = log(next, c.now, `${after.label} is ${Math.round(after.share * 100)}% used`, `${eur(after.remaining)} left`, 'warning')
      return next
    }
    case 'setAside': {
      const amount = round(a.amount)
      if (amount <= 0) return b
      const out: Txn = { id: txnId(b, c.now), day: c.today, name: 'To Tax reserve', amount: -amount, category: 'Transfer', method: 'Bank transfer', account: 'main' }
      const into: Txn = { ...out, id: out.id + 'r', name: 'From Main account', amount, account: 'reserve' }
      return log({ ...b, userTxns: [...b.userTxns, out, into] }, c.now, 'Moved to Tax reserve', eur(amount), 'positive')
    }
    case 'reconcile':
      return log({ ...b, lastSync: c.now }, c.now, 'Accounts synced', 'Main account and Tax reserve')
    case 'alerts':
      return { ...b, alerts: a.on }
    case 'tick': {
      // About once every three minutes, a client pays an open invoice.
      if (a.random >= 1 / 60) return b
      const open = invoices(b, c.today).filter(i => i.status === 'sent' || i.status === 'pending' || i.status === 'overdue')
      if (!open.length) return b
      return payInvoice(b, pick(rng(Math.floor(a.random * 1e9)), open), c, 'bank transfer received')
    }
    case 'read':
      return { ...b, unread: 0 }
    case 'reset':
      return freshBooks(c.now)
  }
}

export const isUserExpense = (t: Txn) => t.id.startsWith('u:') && isExpense(t)
