import { describe, expect, it } from 'vitest'
import { allTxns, balances, budget, freshBooks, invoiceStatus, invoices, kpis, receivables, reduce, seededInvoices, vat, type Books } from './books'
import { day, key, monthStart } from './dates'
import { buckets, dayTxns, history, spendingByCategory, totals } from './ledger'

const OCT15 = day(2026, 9, 15)
const ctx = { today: OCT15, now: Date.UTC(2026, 9, 15, 10) }
const fresh = (): Books => freshBooks(ctx.now)

describe('ledger', () => {
  it('generates the same day the same way every time', () => {
    expect(dayTxns(OCT15, OCT15)).toEqual(dayTxns(OCT15, OCT15))
    expect(dayTxns(day(2026, 9, 1), OCT15).some(t => t.name === 'Office rent' && t.amount === -3200)).toBe(true)
  })

  it('keeps week, month, and year buckets consistent with the transactions', () => {
    const txns = history(OCT15)
    const months = buckets(txns, OCT15, 'month', 12)
    const year = buckets(txns, OCT15, 'year', 2)
    const lastYear = totals(txns, day(2025, 0, 1), day(2025, 11, 31))
    expect(year[0]).toMatchObject({ label: '2025', in: lastYear.in, out: lastYear.out })
    const sept = months.find(m => m.label === 'Sep')!
    expect(sept.net).toBeCloseTo(sept.in - sept.out, 2)
    expect(months.at(-1)!.current).toBe(true)
    expect(buckets(txns, OCT15, 'week')).toHaveLength(7)
  })

  it('looks like a small studio: about €60k in and €45k out a month', () => {
    const sept = totals(history(OCT15), day(2026, 8, 1), day(2026, 8, 30))
    expect(sept.in).toBeGreaterThan(35000)
    expect(sept.in).toBeLessThan(110000)
    expect(sept.out).toBeGreaterThan(35000)
    expect(sept.out).toBeLessThan(60000)
  })

  it('groups spending into the top categories plus Other, with shares that add up to 1', () => {
    const s = spendingByCategory(history(OCT15), day(2026, 8, 1), day(2026, 8, 30))
    expect(s.rows.length).toBeLessThanOrEqual(5)
    expect(s.rows[0].category).toBe('Payroll')
    expect(s.rows.reduce((a, r) => a + r.share, 0)).toBeCloseTo(1, 6)
    expect(s.rows.filter(r => r.category === 'Other')).toHaveLength(1)
  })
})

describe('invoices', () => {
  it('derives the status from the dates', () => {
    const inv = { no: 1, client: 'A', amount: 100, issued: OCT15 - 30, due: OCT15 + 3, sent: true }
    expect(invoiceStatus(inv, OCT15)).toBe('pending')
    expect(invoiceStatus({ ...inv, due: OCT15 + 20 }, OCT15)).toBe('sent')
    expect(invoiceStatus({ ...inv, due: OCT15 - 1 }, OCT15)).toBe('overdue')
    expect(invoiceStatus({ ...inv, sent: false }, OCT15)).toBe('draft')
    expect(invoiceStatus({ ...inv, paidOn: OCT15 }, OCT15)).toBe('paid')
  })

  it('seeds a stable mix of statuses in mid-October', () => {
    const list = invoices(fresh(), OCT15)
    expect(seededInvoices(OCT15)).toEqual(seededInvoices(OCT15))
    expect(list.map(i => i.status)).toEqual(['overdue', 'overdue', 'sent', 'sent', 'sent', 'paid'])
  })

  it('marking an invoice paid books the payment and clears it from overdue', () => {
    const b = fresh()
    const overdue = invoices(b, OCT15).find(i => i.status === 'overdue')!
    const before = receivables(invoices(b, OCT15), allTxns(b, OCT15), OCT15)
    const after = reduce(b, { type: 'markPaid', no: overdue.no }, ctx)
    const r = receivables(invoices(after, OCT15), allTxns(after, OCT15), OCT15)
    expect(r.overdue).toBeCloseTo(before.overdue - overdue.amount, 2)
    expect(r.collected).toBeCloseTo(before.collected + overdue.amount, 2)
    expect(balances(after).main).toBeCloseTo(balances(b).main + overdue.amount, 2)
    expect(after.events[0].text).toContain('paid')
  })

  it('creates drafts and sends them', () => {
    let b = reduce(fresh(), { type: 'createInvoice', client: 'Kestrel Labs', amount: 2500, terms: 30, send: false }, ctx)
    const draft = invoices(b, OCT15).find(i => i.client === 'Kestrel Labs')!
    expect(draft.status).toBe('draft')
    b = reduce(b, { type: 'sendDraft', no: draft.no }, ctx)
    expect(invoices(b, OCT15).find(i => i.no === draft.no)!.status).toBe('sent')
  })
})

describe('money', () => {
  it('an expense lowers the balance and counts against spending and the budget', () => {
    const b = fresh()
    const after = reduce(b, { type: 'addExpense', name: 'Laptop', category: 'Supplies', amount: 1800, method: 'Business card' }, ctx)
    expect(balances(after).main).toBeCloseTo(balances(b).main - 1800, 2)
    expect(budget(allTxns(after, OCT15), OCT15).spent).toBeCloseTo(budget(allTxns(b, OCT15), OCT15).spent + 1800, 2)
    expect(kpis(allTxns(after, OCT15), OCT15).expenses).toBeCloseTo(kpis(allTxns(b, OCT15), OCT15).expenses + 1800, 2)
  })

  it('warns once when the budget passes 90%', () => {
    const b = fresh()
    const left = budget(allTxns(b, OCT15), OCT15)
    const big = left.amount * 0.9 - left.spent + 10
    const after = reduce(b, { type: 'addExpense', name: 'Studio fit-out', category: 'Other', amount: big, method: 'Bank transfer' }, ctx)
    expect(after.events[0].tone).toBe('warning')
    const again = reduce({ ...after, alerts: false }, { type: 'addExpense', name: 'Chairs', category: 'Supplies', amount: 10, method: 'Business card' }, ctx)
    expect(again.events[0].tone).toBe('neutral')
  })

  it('moving money to the Tax reserve covers VAT without changing the cash flow', () => {
    const b = fresh()
    const v = vat(OCT15, balances(b).reserve)
    const after = reduce(b, { type: 'setAside', amount: v.shortfall }, ctx)
    expect(vat(OCT15, balances(after).reserve).share).toBe(1)
    expect(balances(after).main).toBeCloseTo(balances(b).main - v.shortfall, 2)
    expect(totals(allTxns(after, OCT15), monthStart(OCT15), OCT15)).toEqual(totals(allTxns(b, OCT15), monthStart(OCT15), OCT15))
  })

  it('finds the next quarterly VAT deadline', () => {
    expect(key(vat(OCT15, 0).due)).toBe('2026-11-20')
    expect(vat(OCT15, 0).period).toBe('Q3 2026')
    expect(key(vat(day(2026, 11, 1), 0).due)).toBe('2027-02-20')
    expect(vat(day(2026, 11, 1), 0).period).toBe('Q4 2026')
  })
})
