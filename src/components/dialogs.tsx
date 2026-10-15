import { BellRing, CircleCheck, Search, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { invoiceNo } from '../sim/books'
import { shortDate } from '../sim/dates'
import { CATEGORIES, CLIENTS, type Category, type Method } from '../sim/ledger'
import type { BooksApi } from '../sim/useBooks'
import { InvoiceRow, TxnRow } from './Overview'
import { Badge, Button, Dialog, eur, STROKE } from './ui'

export function NewInvoiceDialog({ api, open, onClose }: { api: BooksApi; open: boolean; onClose: () => void }) {
  const [client, setClient] = useState<string>(CLIENTS[6])
  const [amount, setAmount] = useState('')
  const [terms, setTerms] = useState(30)
  const submit = (send: boolean) => {
    const v = Number(amount.replace(',', '.'))
    if (!(v > 0)) return
    api.act({ type: 'createInvoice', client, amount: v, terms, send })
    setAmount('')
    onClose()
  }
  return (
    <Dialog open={open} onClose={onClose} title="New invoice">
      <form className="form" onSubmit={e => { e.preventDefault(); submit(true) }}>
        <label className="field">
          <span className="t-label">Client</span>
          <select value={client} onChange={e => setClient(e.target.value)}>{CLIENTS.map(c => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="field">
          <span className="t-label">Amount (EUR, VAT included)</span>
          <input required inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 2,400" />
        </label>
        <label className="field">
          <span className="t-label">Payment terms</span>
          <select value={terms} onChange={e => setTerms(Number(e.target.value))}>{[14, 30, 45, 60].map(d => <option key={d} value={d}>{d} days</option>)}</select>
        </label>
        <div className="form-actions">
          <Button kind="ghost" onClick={() => submit(false)}>Save draft</Button>
          <Button type="submit" icon={Send}>Send invoice</Button>
        </div>
      </form>
    </Dialog>
  )
}

const METHODS: Method[] = ['Business card', 'Bank transfer', 'Direct debit']

export function ExpenseDialog({ api, open, onClose }: { api: BooksApi; open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('Supplies')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<Method>('Business card')
  return (
    <Dialog open={open} onClose={onClose} title="Add expense">
      <form className="form" onSubmit={e => {
        e.preventDefault()
        const v = Number(amount.replace(',', '.'))
        if (!name.trim() || !(v > 0)) return
        api.act({ type: 'addExpense', name: name.trim(), category, amount: v, method })
        setName(''); setAmount('')
        onClose()
      }}>
        <label className="field">
          <span className="t-label">Description</span>
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. External monitor" />
        </label>
        <div className="field-row">
          <label className="field">
            <span className="t-label">Category</span>
            <select value={category} onChange={e => setCategory(e.target.value as Category)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
          </label>
          <label className="field">
            <span className="t-label">Amount (EUR)</span>
            <input required inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 249.90" />
          </label>
        </div>
        <label className="field">
          <span className="t-label">Paid with</span>
          <select value={method} onChange={e => setMethod(e.target.value as Method)}>{METHODS.map(m => <option key={m}>{m}</option>)}</select>
        </label>
        <div className="form-actions">
          <Button kind="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit">Add expense</Button>
        </div>
      </form>
    </Dialog>
  )
}

export function InvoiceDialog({ api, no, onClose }: { api: BooksApi; no: number | null; onClose: () => void }) {
  const inv = api.invoices.find(i => i.no === no)
  const reminded = no !== null ? api.books.reminded[no] : undefined
  return (
    <Dialog open={no !== null && !!inv} onClose={onClose} title={inv ? invoiceNo(inv.no) : 'Invoice'}>
      {inv && (
        <div className="invoice-detail">
          <div className="detail-head">
            <div>
              <p className="t-h2">{inv.client}</p>
              <p className="t-display-kpi tnum">{eur(inv.amount)}</p>
            </div>
            <Badge status={inv.status} />
          </div>
          <dl className="detail-list">
            <div><dt className="t-caption c-tertiary">Issued</dt><dd className="t-body-medium">{shortDate(inv.issued)}</dd></div>
            <div><dt className="t-caption c-tertiary">Due</dt><dd className="t-body-medium">{shortDate(inv.due)}{inv.status === 'overdue' ? ` · ${api.today - inv.due} days late` : ''}</dd></div>
            <div><dt className="t-caption c-tertiary">Paid</dt><dd className="t-body-medium">{inv.paidOn !== undefined && inv.status === 'paid' ? shortDate(inv.paidOn) : '—'}</dd></div>
          </dl>
          {reminded !== undefined && <p className="t-caption c-secondary">Reminder sent {shortDate(reminded)}.</p>}
          <div className="form-actions">
            {inv.status === 'draft' && <Button icon={Send} onClick={() => api.act({ type: 'sendDraft', no: inv.no })}>Send invoice</Button>}
            {(inv.status === 'overdue' || inv.status === 'pending') && <Button kind="secondary" icon={BellRing} disabled={reminded === api.today} onClick={() => api.act({ type: 'remind', no: inv.no })}>{reminded === api.today ? 'Reminder sent' : 'Send reminder'}</Button>}
            {inv.status !== 'paid' && inv.status !== 'draft' && <Button icon={CircleCheck} onClick={() => api.act({ type: 'markPaid', no: inv.no })}>Mark as paid</Button>}
            {inv.status === 'paid' && <Button kind="secondary" onClick={onClose}>Close</Button>}
          </div>
        </div>
      )}
    </Dialog>
  )
}

export function AllInvoicesDialog({ api, open, onClose, onOpen }: { api: BooksApi; open: boolean; onClose: () => void; onOpen: (no: number) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="All invoices" wide>
      <div className="rows scroll">{api.invoices.map(inv => <InvoiceRow key={inv.no} inv={inv} onOpen={onOpen} />)}</div>
    </Dialog>
  )
}

export function AllTransactionsDialog({ api, open, onClose, initialQuery = '' }: { api: BooksApi; open: boolean; onClose: () => void; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery)
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    const recent = api.txns.filter(t => t.account === 'main' && t.day > api.today - 90).reverse()
    return (s ? recent.filter(t => `${t.name} ${t.category} ${t.method}`.toLowerCase().includes(s)) : recent).slice(0, 60)
  }, [api.txns, api.today, q])
  return (
    <Dialog open={open} onClose={onClose} title="Transactions" wide>
      <label className="search search-inline">
        <Search size={18} strokeWidth={STROKE} aria-hidden="true" />
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Filter by name, category, or method" aria-label="Filter transactions" autoFocus />
      </label>
      <p className="t-caption c-tertiary">Last 90 days · {list.length === 60 ? 'first 60 shown' : `${list.length} found`}</p>
      <div className="rows scroll">{list.map(t => <TxnRow key={t.id} t={t} />)}</div>
    </Dialog>
  )
}
