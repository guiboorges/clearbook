import { Bell, Calculator, CalendarDays, ChartColumn, FileText, Landmark, LayoutDashboard, Plus, Receipt, RotateCcw, Search, Settings } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import dusk from './assets/studio-dusk.jpg'
import morning from './assets/studio-morning.jpg'
import { AllInvoicesDialog, AllTransactionsDialog, ExpenseDialog, InvoiceDialog, NewInvoiceDialog } from './components/dialogs'
import {
  AccountCard, ago, BudgetCard, CashFlowCard, InvoicesCard, Kpis, SpendingCard, TransactionsCard, TxnRow, VatCard,
} from './components/Overview'
import { Avatar, Button, eur, IconButton, Segmented, STROKE } from './components/ui'
import { invoiceNo } from './sim/books'
import { key, monthStart, shortDate } from './sim/dates'
import { useBooks } from './sim/useBooks'

type Theme = 'dark' | 'light'
function initialTheme(): Theme {
  const param = new URLSearchParams(location.search).get('theme')
  if (param === 'dark' || param === 'light') return param
  try {
    const saved = localStorage.getItem('clearbook:theme')
    if (saved === 'dark' || saved === 'light') return saved
  } catch { /* storage blocked */ }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'banking', label: 'Banking', icon: Landmark },
  { id: 'reports', label: 'Reports', icon: ChartColumn },
  { id: 'tax', label: 'Tax', icon: Calculator },
] as const
type Section = (typeof SECTIONS)[number]['id']

function useScrollSpy(): [Section, (id: Section) => void] {
  const [active, setActive] = useState<Section>('overview')
  useEffect(() => {
    const onScroll = () => {
      const line = window.innerHeight * 0.3
      let cur: Section = 'overview'
      let best = -Infinity
      for (const s of SECTIONS) {
        const top = document.getElementById(s.id)?.getBoundingClientRect().top ?? Infinity
        if (top <= line && top > best) { best = top; cur = s.id }
      }
      if (window.scrollY < 40) cur = 'overview'
      setActive(cur)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const go = (id: Section) => {
    setActive(id)
    const el = document.getElementById(id)
    if (id === 'overview') window.scrollTo({ top: 0, behavior: 'smooth' })
    else el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el?.querySelector<HTMLElement>('h2, [tabindex]')?.focus({ preventScroll: true })
  }
  return [active, go]
}

function downloadCsv(api: ReturnType<typeof useBooks>) {
  const from = monthStart(api.today)
  const rows = api.txns.filter(t => t.account === 'main' && t.day >= from)
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const csv = ['Date,Description,Category,Method,Amount (EUR)', ...rows.map(t => [key(t.day), esc(t.name), esc(t.category), esc(t.method), t.amount.toFixed(2)].join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `studio-vela-${key(api.today).slice(0, 7)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function App() {
  const api = useBooks()
  const { books, act, now } = api
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [active, go] = useScrollSpy()
  const [menu, setMenu] = useState<null | 'add' | 'calendar' | 'bell' | 'settings' | 'search'>(null)
  const [dialog, setDialog] = useState<null | 'invoice' | 'expense' | 'invoices' | 'txns'>(null)
  const [openInvoice, setOpenInvoice] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.style.setProperty('--backdrop', `url("${theme === 'dark' ? dusk : morning}")`)
    try { localStorage.setItem('clearbook:theme', theme) } catch { /* storage blocked */ }
  }, [theme])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'Escape') setMenu(null)
    }
    const onDown = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.anchor')) setMenu(null) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown) }
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return api.txns.filter(t => t.account === 'main' && t.day > api.today - 90 && `${t.name} ${t.category}`.toLowerCase().includes(q)).reverse().slice(0, 5)
  }, [query, api.txns, api.today])

  const upcoming = useMemo(() => {
    const items: { day: number; text: string; detail: string }[] = []
    for (const inv of api.invoices) if (inv.status !== 'paid' && inv.status !== 'draft' && inv.due <= api.today + 30) items.push({ day: inv.due, text: `${invoiceNo(inv.no)} · ${inv.client}`, detail: `${eur(inv.amount)} ${inv.due < api.today ? 'overdue' : 'due'}` })
    items.push({ day: api.vat.due, text: `VAT ${api.vat.period}`, detail: eur(api.vat.amount) })
    const ms = monthStart(api.today)
    const salaries = ms + 24 >= api.today ? ms + 24 : monthStart(ms + 40) + 24
    items.push({ day: salaries, text: 'Salaries', detail: 'Payroll run' })
    items.push({ day: monthStart(ms + 40), text: 'Office rent', detail: eur(3200) })
    return items.sort((a, b) => a.day - b.day).slice(0, 7)
  }, [api.invoices, api.today, api.vat])

  const toggleMenu = (m: NonNullable<typeof menu>) => setMenu(menu === m ? null : m)

  return (
    <>
      <div className="backdrop" aria-hidden="true" />
      <div className="window">
        <nav className="sidebar" aria-label="Sections">
          <span className="logo" aria-hidden="true">cb</span>
          <span className="sidebar-gap" />
          {SECTIONS.map(s => (
            <button key={s.id} type="button" className="nav-item" aria-current={active === s.id ? 'true' : undefined} aria-label={s.label} title={s.label} onClick={() => go(s.id)}>
              <s.icon size={22} strokeWidth={STROKE} aria-hidden="true" />
            </button>
          ))}
          <span className="grow" />
          <div className="anchor">
            <button type="button" className="nav-item" aria-label="Settings" title="Settings" aria-expanded={menu === 'settings'} onClick={() => toggleMenu('settings')}>
              <Settings size={22} strokeWidth={STROKE} aria-hidden="true" />
            </button>
            {menu === 'settings' && (
              <div className="popover settings" role="dialog" aria-label="Settings">
                <p className="t-label c-secondary">Appearance</p>
                <Segmented label="Appearance" value={theme} onChange={setTheme} options={[{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }]} />
                <hr />
                <p className="t-caption c-secondary">Studio Vela is a simulated business. Your changes are saved in this browser only.</p>
                <Button kind="secondary" icon={RotateCcw} onClick={() => { act({ type: 'reset' }); setMenu(null) }}>Reset demo</Button>
              </div>
            )}
          </div>
        </nav>

        <main className="main">
          <header className="header">
            <nav className="tabs" aria-label="Overview sections">
              {SECTIONS.slice(0, 5).map(s => (
                <button key={s.id} type="button" className="tab" aria-current={active === s.id ? 'true' : undefined} onClick={() => go(s.id)}>{s.label}</button>
              ))}
            </nav>
            <div className="header-actions">
              <div className="anchor search-anchor">
                <label className="search">
                  <Search size={18} strokeWidth={STROKE} aria-hidden="true" />
                  <input ref={searchRef} type="search" value={query} placeholder="Search transactions" aria-label="Search transactions"
                    onChange={e => { setQuery(e.target.value); setMenu('search') }} onFocus={() => setMenu('search')}
                    onKeyDown={e => { if (e.key === 'Enter' && query.trim()) { setDialog('txns'); setMenu(null) } }} />
                </label>
                {menu === 'search' && query.trim() && (
                  <div className="popover search-results" role="dialog" aria-label="Search results">
                    {results.length ? results.map(t => <TxnRow key={t.id} t={t} />) : <p className="t-body c-secondary">No transaction matches “{query}” in the last 90 days.</p>}
                    {results.length > 0 && <Button kind="ghost" onClick={() => { setDialog('txns'); setMenu(null) }}>See all results</Button>}
                  </div>
                )}
              </div>
              <div className="anchor">
                <IconButton icon={Plus} label="Create" look="outline" aria-expanded={menu === 'add'} onClick={() => toggleMenu('add')} />
                {menu === 'add' && (
                  <div className="popover menu" role="menu" aria-label="Create">
                    <button type="button" role="menuitem" className="menu-item" onClick={() => { setDialog('invoice'); setMenu(null) }}><FileText size={18} strokeWidth={STROKE} aria-hidden="true" />New invoice</button>
                    <button type="button" role="menuitem" className="menu-item" onClick={() => { setDialog('expense'); setMenu(null) }}><Receipt size={18} strokeWidth={STROKE} aria-hidden="true" />Add expense</button>
                  </div>
                )}
              </div>
              <span className="divider" aria-hidden="true" />
              <div className="anchor">
                <IconButton icon={CalendarDays} label="Upcoming" aria-expanded={menu === 'calendar'} onClick={() => toggleMenu('calendar')} />
                {menu === 'calendar' && (
                  <div className="popover list-pop" role="dialog" aria-label="Upcoming">
                    <p className="t-h3">Upcoming</p>
                    <ul>
                      {upcoming.map((u, i) => (
                        <li key={i}><span className="date-chip t-label-small tnum" data-late={u.day < api.today || undefined}>{shortDate(u.day)}</span><span className="t-body-medium">{u.text}</span><span className="t-caption c-tertiary">{u.detail}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="anchor">
                <IconButton icon={Bell} label="Notifications" dot={books.unread > 0} aria-expanded={menu === 'bell'} onClick={() => { toggleMenu('bell'); act({ type: 'read' }) }} />
                {menu === 'bell' && (
                  <div className="popover list-pop" role="dialog" aria-label="Notifications">
                    <p className="t-h3">Activity</p>
                    <ul>
                      {books.events.slice(0, 8).map(e => (
                        <li key={e.id}><span className="event-dot" data-tone={e.tone} aria-hidden="true" /><span className="t-body-medium">{e.text}</span><span className="t-caption c-tertiary">{e.detail ? `${e.detail} · ` : ''}{ago(now.getTime() - e.at)}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <span title="Guilherme Borges"><Avatar initials="GB" /></span>
            </div>
          </header>

          <Kpis api={api} />
          <div className="grid">
            <BudgetCard api={api} onInvoice={() => setDialog('invoice')} onExpense={() => setDialog('expense')} onExport={() => downloadCsv(api)} />
            <CashFlowCard api={api} />
            <InvoicesCard api={api} onOpen={setOpenInvoice} onAll={() => setDialog('invoices')} />
            <div className="stack">
              <AccountCard api={api} />
              <VatCard api={api} />
            </div>
            <SpendingCard api={api} />
            <TransactionsCard api={api} onAll={() => { setQuery(''); setDialog('txns') }} />
          </div>
        </main>
      </div>
      <p className="footnote t-caption">
        Clearbook demo · Studio Vela is a simulated design studio; every figure is generated. Built with the Clearbook design system.
      </p>

      <NewInvoiceDialog api={api} open={dialog === 'invoice'} onClose={() => setDialog(null)} />
      <ExpenseDialog api={api} open={dialog === 'expense'} onClose={() => setDialog(null)} />
      <AllInvoicesDialog api={api} open={dialog === 'invoices'} onClose={() => setDialog(null)} onOpen={no => { setDialog(null); setOpenInvoice(no) }} />
      <AllTransactionsDialog key={dialog === 'txns' ? query : 'closed'} api={api} open={dialog === 'txns'} onClose={() => setDialog(null)} initialQuery={query} />
      <InvoiceDialog api={api} no={openInvoice} onClose={() => setOpenInvoice(null)} />
    </>
  )
}
