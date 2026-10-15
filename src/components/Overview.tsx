import {
  ArrowDownRight, Building2, ChartColumn, ChevronRight, Coins, CreditCard, Download, FileText, Landmark, Megaphone,
  OctagonAlert, Package, PiggyBank, Plane, Receipt, RefreshCw, ShieldCheck, TrendingDown, TrendingUp, Users, Wallet, Wrench, type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { invoiceNo, type InvoiceView } from '../sim/books'
import { monthStart, shortDate } from '../sim/dates'
import { buckets, spendingByCategory, type Period, type Txn } from '../sim/ledger'
import type { BooksApi } from '../sim/useBooks'
import {
  Avatar, Badge, Button, CardHeader, eur, eur0, eurK, Gauge, IconTile, initialsOf, KpiCard, Legend, pctText, ProgressRow,
  QuickAction, Segmented, signed, Toggle,
} from './ui'

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  Payroll: Users, 'Rent & utilities': Building2, Contractors: Wrench, Software: ChartColumn, Marketing: Megaphone,
  Travel: Plane, Supplies: Package, Other: Receipt, Income: ArrowDownRight, Transfer: PiggyBank,
}

export function ago(ms: number) {
  const m = Math.round(ms / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h} h ago` : `${Math.round(h / 24)} d ago`
}

export function Kpis({ api }: { api: BooksApi }) {
  const { kpis: k, receivables: r } = api
  return (
    <div className="kpis" id="overview">
      <KpiCard label="Revenue" icon={Wallet} value={eur0(k.revenue)} delta={pctText(k.revenueDelta)} trend={k.revenueDelta >= 0 ? 'positive' : 'negative'} period={k.compareLabel} />
      <KpiCard label="Expenses" icon={Receipt} value={eur0(k.expenses)} delta={pctText(k.expensesDelta)} trend={k.expensesDelta > 0 ? 'negative' : 'positive'}
        deltaIcon={k.expensesDelta >= 0 ? TrendingUp : TrendingDown} period={k.compareLabel} />
      <KpiCard label="Net profit" icon={Coins} value={eur0(k.net)} delta={pctText(k.netDelta)} trend={k.netDelta >= 0 ? 'positive' : 'negative'} period={`margin ${(k.margin * 100).toFixed(1)}%`} />
      {r.overdueCount ? (
        <KpiCard label="Overdue invoices" icon={FileText} value={eur0(r.overdue)} delta={`${r.overdueCount} invoice${r.overdueCount > 1 ? 's' : ''}`} deltaIcon={OctagonAlert} trend="negative" period={`oldest ${r.oldestOverdueDays} days`} />
      ) : (
        <KpiCard label="Overdue invoices" icon={FileText} value={eur0(0)} delta="None overdue" deltaIcon={ShieldCheck} trend="positive" period={`${eur0(r.outstanding)} outstanding`} />
      )}
    </div>
  )
}

export function BudgetCard({ api, onInvoice, onExpense, onExport }: { api: BooksApi; onInvoice: () => void; onExpense: () => void; onExport: () => void }) {
  const { budget: b, books, act } = api
  const [syncing, setSyncing] = useState(false)
  return (
    <section className="card budget" aria-labelledby="budget-title">
      <CardHeader id="budget-title" title={b.label} subtitle="Operating expenses">
        <Toggle on={books.alerts} onChange={on => act({ type: 'alerts', on })} label="Alert me at 90% of the budget" />
      </CardHeader>
      <Gauge value={b.share} label={b.label} caption={`of ${b.label}`} />
      <div className="stats">
        <div><span className="t-caption c-tertiary">Spent</span><span className="t-numeric tnum">{eur0(b.spent)}</span></div>
        <div className="end"><span className="t-caption c-tertiary">Remaining</span><span className="t-numeric tnum">{eur0(b.remaining)}</span></div>
      </div>
      <div className="quick">
        <span className="t-label-small c-tertiary">Quick actions</span>
        <div className="quick-row">
          <QuickAction icon={FileText} label="Invoice" selected onClick={onInvoice} />
          <QuickAction icon={Receipt} label="Expense" onClick={onExpense} />
          <QuickAction icon={RefreshCw} label={syncing ? 'Syncing…' : 'Reconcile'} disabled={syncing} data-spin={syncing || undefined}
            onClick={() => { setSyncing(true); setTimeout(() => { act({ type: 'reconcile' }); setSyncing(false) }, 900) }} />
          <QuickAction icon={Download} label="Export" onClick={onExport} />
        </div>
      </div>
    </section>
  )
}

const PERIODS: { id: Period; label: string }[] = [{ id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'year', label: 'Year' }]

export function CashFlowCard({ api }: { api: BooksApi }) {
  const [period, setPeriod] = useState<Period>('month')
  const [picked, setPicked] = useState<number | null>(null)
  const data = useMemo(() => buckets(api.txns, api.today, period), [api.txns, api.today, period])
  const sel = picked ?? data.length - 1
  const s = data[sel]
  const max = Math.max(...data.map(d => Math.abs(d.net)), 1)
  const what = period === 'month' ? `net in ${s.label}` : period === 'week' ? `net, week of ${s.label}` : `net in ${s.label}`
  return (
    <section className="card cashflow" id="reports" aria-labelledby="cash-title">
      <CardHeader id="cash-title" title="Cash flow" subtitle={`Net, last 7 ${period}s`}>
        <Segmented label="Period" options={PERIODS} value={period} onChange={p => { setPeriod(p); setPicked(null) }} />
      </CardHeader>
      <p className="big"><span className="t-display-hero tnum">{eurK(s.net)}</span><span className="t-body c-secondary">{what}{s.current ? ' so far' : ''}</span></p>
      <Legend items={[{ label: s.current ? `${s.label} (current)` : s.label, series: 'accent' }, { label: 'Other periods', series: 'neutral' }]} />
      <div className="chart" role="group" aria-label="Net cash flow by period. Select a bar to see its totals.">
        {data.map((d, i) => (
          <button key={d.label} type="button" className="chart-col" aria-pressed={i === sel} aria-label={`${d.label}: net ${eur(d.net)}`} onClick={() => setPicked(i)}>
            <span className="chart-tip t-numeric-small tnum" aria-hidden="true">{eurK(d.net)}</span>
            <span className="chart-bar" data-negative={d.net < 0 || undefined} style={{ height: `${Math.max(3, (Math.abs(d.net) / max) * 100)}%` }} />
            <span className="chart-label t-caption">{d.label}</span>
          </button>
        ))}
      </div>
      <table className="sr-only">
        <caption>Cash flow, last 7 {period}s</caption>
        <thead><tr><th>Period</th><th>Cash in</th><th>Cash out</th><th>Net</th></tr></thead>
        <tbody>{data.map(d => <tr key={d.label}><td>{d.label}</td><td>{eur(d.in)}</td><td>{eur(d.out)}</td><td>{eur(d.net)}</td></tr>)}</tbody>
      </table>
      <div className="grow" />
      <dl className="footer-stats">
        <div><dt className="t-caption c-tertiary">Cash in</dt><dd className="t-numeric tnum">{eurK(s.in)}</dd></div>
        <div><dt className="t-caption c-tertiary">Cash out</dt><dd className="t-numeric tnum">{eurK(s.out)}</dd></div>
        <div><dt className="t-caption c-tertiary">Net</dt><dd className="t-numeric tnum" data-tone={s.net >= 0 ? 'positive' : 'negative'}>{s.net >= 0 ? '+' : ''}{eurK(s.net)}</dd></div>
      </dl>
    </section>
  )
}

export function InvoiceRow({ inv, onOpen }: { inv: InvoiceView; onOpen: (no: number) => void }) {
  const when = inv.status === 'paid' ? `Paid ${shortDate(inv.paidOn!)}` : inv.status === 'draft' ? 'Not sent' : `Due ${shortDate(inv.due)}`
  return (
    <button type="button" className="row invoice-row" onClick={() => onOpen(inv.no)} aria-label={`${inv.client}, ${invoiceNo(inv.no)}, ${eur(inv.amount)}, ${inv.status}. Open`}>
      <Avatar initials={initialsOf(inv.client)} />
      <span className="row-text">
        <span className="t-body-medium truncate">{inv.client}</span>
        <span className="t-caption c-tertiary truncate">{invoiceNo(inv.no)} · {when}</span>
      </span>
      <span className="t-numeric tnum amount">{eur(inv.amount)}</span>
      <span className="status-cell"><Badge status={inv.status} /></span>
    </button>
  )
}

export function InvoicesCard({ api, onOpen, onAll }: { api: BooksApi; onOpen: (no: number) => void; onAll: () => void }) {
  const r = api.receivables
  return (
    <section className="card invoices" id="invoices" aria-labelledby="inv-title">
      <CardHeader id="inv-title" title="Invoices" subtitle={`${eur0(r.outstanding)} outstanding`}>
        <Button kind="ghost" onClick={onAll}>View all</Button>
      </CardHeader>
      <div className="rows">
        {api.invoices.slice(0, 5).map(inv => <InvoiceRow key={inv.no} inv={inv} onOpen={onOpen} />)}
      </div>
      <div className="grow" />
      <dl className="footer-stats">
        <div><dt className="t-caption c-tertiary">Outstanding</dt><dd className="t-numeric tnum">{eur0(r.outstanding)}</dd></div>
        <div><dt className="t-caption c-tertiary">Overdue</dt><dd className="t-numeric tnum" data-tone={r.overdue ? 'negative' : undefined}>{eur0(r.overdue)}</dd></div>
        <div><dt className="t-caption c-tertiary">Collected this month</dt><dd className="t-numeric tnum">{eur0(r.collected)}</dd></div>
      </dl>
    </section>
  )
}

export function AccountCard({ api }: { api: BooksApi }) {
  const [syncing, setSyncing] = useState(false)
  return (
    <section className="card account" id="banking" aria-labelledby="acc-title">
      <div className="account-top">
        <div>
          <p className="t-caption c-tertiary">Operating</p>
          <h2 className="t-h2" id="acc-title">Main account</h2>
        </div>
        <IconTile icon={Landmark} />
      </div>
      <div>
        <p className="t-h1 tnum">{eur(api.balances.main)}</p>
        <p className="t-caption c-tertiary">PT50 •••• 4821</p>
      </div>
      <button type="button" className="sync" disabled={syncing} onClick={() => { setSyncing(true); setTimeout(() => { api.act({ type: 'reconcile' }); setSyncing(false) }, 900) }}>
        <span className="sync-knob" data-spin={syncing || undefined}><RefreshCw size={16} strokeWidth={2} aria-hidden="true" /></span>
        <span className="t-label-small c-secondary">{syncing ? 'Syncing…' : `Synced ${ago(api.now.getTime() - api.books.lastSync)}`}</span>
        <ChevronRight size={16} strokeWidth={2} aria-hidden="true" className="c-tertiary" />
      </button>
    </section>
  )
}

export function VatCard({ api }: { api: BooksApi }) {
  const v = api.vat
  const status = v.daysLeft <= 7 ? 'overdue' : 'pending'
  return (
    <section className="card vat" id="tax" aria-labelledby="vat-title">
      <CardHeader id="vat-title" title="Next VAT payment" subtitle={`${v.period} · due ${shortDate(v.due)}`}>
        <Badge status={v.share >= 1 ? 'paid' : status} label={v.share >= 1 ? 'Covered' : v.daysLeft <= 7 ? 'Due soon' : 'Pending'} />
      </CardHeader>
      <p className="big"><span className="t-h1 tnum">{eur(v.amount)}</span><span className="t-body c-secondary">in {v.daysLeft} days</span></p>
      <ProgressRow icon={PiggyBank} tone="accent" label="Set aside in Tax reserve" amount={eur0(v.covered)} share={v.share}
        caption={v.shortfall > 0 ? `${Math.floor(v.share * 100)}% covered · ${eur0(v.shortfall)} to go` : 'Fully covered'} />
      {v.shortfall > 0 && <Button kind="secondary" icon={PiggyBank} onClick={() => api.act({ type: 'setAside', amount: v.shortfall })}>Move {eur0(v.shortfall)} to reserve</Button>}
    </section>
  )
}

export function SpendingCard({ api }: { api: BooksApi }) {
  const from = monthStart(api.today)
  const s = useMemo(() => spendingByCategory(api.txns, from, api.today), [api.txns, from, api.today])
  const top = Math.max(...s.rows.map(r => r.share), 0.01)
  return (
    <section className="card spending" id="expenses" aria-labelledby="sp-title">
      <CardHeader id="sp-title" title="Spending by category" subtitle={`This month · ${eur0(s.total)} total`} />
      <div className="rows gap-16">
        {s.rows.map(r => (
          <ProgressRow key={r.category} icon={CATEGORY_ICON[r.category] ?? Receipt} label={r.category} amount={eur0(r.amount)} share={r.share} scale={0.9 / top}
            caption={`${Math.round(r.share * 100)}% of expenses`} />
        ))}
      </div>
    </section>
  )
}

export function TxnRow({ t }: { t: Txn }) {
  const income = t.amount > 0 && t.category === 'Income'
  return (
    <div className="row txn-row">
      <IconTile icon={income ? ArrowDownRight : t.method === 'Business card' ? CreditCard : CATEGORY_ICON[t.category] ?? Receipt} tone={income ? 'positive' : 'neutral'} />
      <span className="row-text">
        <span className="t-body-medium truncate">{t.name}</span>
        <span className="t-caption c-tertiary truncate">{shortDate(t.day)} · {t.method}</span>
      </span>
      <span className="row-end">
        <span className="t-numeric tnum" data-tone={income ? 'positive' : undefined}>{signed(t.amount)}</span>
        <span className="t-caption c-tertiary">{t.category}</span>
      </span>
    </div>
  )
}

export function TransactionsCard({ api, onAll }: { api: BooksApi; onAll: () => void }) {
  const recent = useMemo(() => api.txns.filter(t => t.account === 'main' && t.category !== 'Transfer').slice(-6).reverse(), [api.txns])
  return (
    <section className="card transactions" aria-labelledby="tx-title">
      <CardHeader id="tx-title" title="Recent transactions" subtitle="Main account">
        <Button kind="ghost" onClick={onAll}>View all</Button>
      </CardHeader>
      <div className="rows">{recent.map(t => <TxnRow key={t.id} t={t} />)}</div>
    </section>
  )
}
