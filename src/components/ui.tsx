// Clearbook components, one-to-one with the Figma library (page "Components").
import { Check, CircleCheck, Clock, FileText, OctagonAlert, Send, TrendingDown, TrendingUp, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import type { InvoiceStatus } from '../sim/books'

export const STROKE = 2
const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const whole = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
export const eur = (v: number) => money.format(v).replace('-', '−')
export const eur0 = (v: number) => whole.format(v).replace('-', '−')
export const eurK = (v: number) => `${v < 0 ? '−' : ''}€${(Math.abs(v) / 1000).toFixed(1)}k`
export const signed = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + eur(Math.abs(v))
export const pctText = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)}%`

type ButtonKind = 'primary' | 'secondary' | 'inverse' | 'ghost'
export function Button({ kind = 'primary', icon: Icon, children, ...rest }: { kind?: ButtonKind; icon?: LucideIcon; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="btn" data-kind={kind} {...rest}>
      {Icon && <Icon size={18} strokeWidth={STROKE} aria-hidden="true" />}
      {children}
    </button>
  )
}

type IconButtonStyle = 'glass' | 'inverse' | 'accent' | 'outline'
export function IconButton({ icon: Icon, label, look = 'glass', dot, ...rest }: { icon: LucideIcon; label: string; look?: IconButtonStyle; dot?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="icon-btn" data-look={look} aria-label={label} title={label} {...rest}>
      <Icon size={20} strokeWidth={STROKE} aria-hidden="true" />
      {dot && <span className="icon-btn-dot" aria-hidden="true" />}
    </button>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} className="toggle" data-on={on} onClick={() => onChange(!on)}>
      <span className="toggle-knob" />
    </button>
  )
}

const BADGE: Record<InvoiceStatus, { icon: LucideIcon; label: string }> = {
  paid: { icon: CircleCheck, label: 'Paid' },
  pending: { icon: Clock, label: 'Pending' },
  overdue: { icon: OctagonAlert, label: 'Overdue' },
  sent: { icon: Send, label: 'Sent' },
  draft: { icon: FileText, label: 'Draft' },
}
export function Badge({ status, label }: { status: InvoiceStatus; label?: string }) {
  const { icon: Icon, label: text } = BADGE[status]
  return (
    <span className="badge" data-status={status}>
      <Icon size={14} strokeWidth={STROKE} aria-hidden="true" />
      {label ?? text}
    </span>
  )
}

export function Avatar({ initials, size = 40 }: { initials: string; size?: 32 | 40 }) {
  return <span className="avatar" data-size={size} aria-hidden="true">{initials}</span>
}
export const initialsOf = (name: string) => name.replace(/[^A-Za-z ]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

export type TileTone = 'neutral' | 'accent' | 'positive' | 'negative'
export function IconTile({ icon: Icon, tone = 'neutral' }: { icon: LucideIcon; tone?: TileTone }) {
  return (
    <span className="icon-tile" data-tone={tone} aria-hidden="true">
      <Icon size={20} strokeWidth={STROKE} />
    </span>
  )
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className="segment" onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  )
}

export function CardHeader({ title, subtitle, children, id }: { title: string; subtitle?: string; children?: ReactNode; id?: string }) {
  return (
    <div className="card-header">
      <div>
        <h2 className="t-h2" id={id}>{title}</h2>
        {subtitle && <p className="t-caption c-tertiary">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

export type Trend = 'positive' | 'negative'
export function KpiCard({ label, icon, value, delta, deltaIcon, trend, period }: {
  label: string; icon: LucideIcon; value: string; delta: string; deltaIcon?: LucideIcon; trend: Trend; period: string
}) {
  const DeltaIcon = deltaIcon ?? (trend === 'positive' ? TrendingUp : TrendingDown)
  return (
    <section className="card kpi" aria-label={label}>
      <div className="kpi-top">
        <span className="t-body-medium c-secondary">{label}</span>
        <IconTile icon={icon} />
      </div>
      <p className="t-display-kpi tnum">{value}</p>
      <p className="kpi-delta">
        <span className="kpi-delta-value t-label" data-trend={trend}><DeltaIcon size={16} strokeWidth={STROKE} aria-hidden="true" />{delta}</span>
        <span className="t-caption c-tertiary">{period}</span>
      </p>
    </section>
  )
}

/** Radial gauge from the reference thermostat: ring, 60 ticks, arc, end knob, value in the center. */
export function Gauge({ value, label, caption, size = 232 }: { value: number; label: string; caption: string; size?: number }) {
  const v = Math.min(1, Math.max(0, value))
  const c = 116
  const r = 110.2 // Figma ring: outer 116, inner radius 0.9 → 11.6 px stroke centered at 110.2
  const end = -Math.PI / 2 + Math.PI * 2 * v
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2
    const len = i % 5 === 0 ? 9 : 6
    return { x1: c + Math.cos(a) * 94, y1: c + Math.sin(a) * 94, x2: c + Math.cos(a) * (94 - len), y2: c + Math.sin(a) * (94 - len), major: i % 5 === 0 }
  })
  return (
    <div className="gauge" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(v * 100)}% ${caption}`}>
      <svg viewBox="0 0 232 232" width={size} height={size} aria-hidden="true">
        <circle cx={c} cy={c} r={r} className="gauge-track" />
        {ticks.map((t, i) => <line key={i} {...t} className="gauge-tick" data-major={t.major || undefined} />)}
        <circle cx={c} cy={c} r={r} className="gauge-value" pathLength={100} strokeDasharray={`${v * 100} 100`} transform={`rotate(-90 ${c} ${c})`} />
        <circle cx={c + Math.cos(end) * r} cy={c + Math.sin(end) * r} r={8} className="gauge-knob" />
      </svg>
      <div className="gauge-readout">
        <span className="t-display-hero tnum">{Math.round(v * 100)}%</span>
        <span className="t-caption c-secondary">{caption}</span>
      </div>
    </div>
  )
}

export function ProgressRow({ icon, tone = 'neutral', label, amount, share, caption, scale = 1 }: {
  icon: LucideIcon; tone?: TileTone; label: string; amount: string; share: number; caption: string; scale?: number
}) {
  const width = Math.max(0.02, Math.min(1, share * scale))
  return (
    <div className="progress-row">
      <IconTile icon={icon} tone={tone} />
      <div className="progress-body">
        <div className="progress-top">
          <span className="t-body-medium">{label}</span>
          <span className="t-numeric tnum">{amount}</span>
        </div>
        <div className="progress-track" role="meter" aria-label={label} aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span className="progress-fill" style={{ width: `${width * 100}%` }} />
        </div>
        <span className="t-caption c-tertiary">{caption}</span>
      </div>
    </div>
  )
}

export function Legend({ items }: { items: { label: string; series: 'accent' | 'neutral' }[] }) {
  return (
    <ul className="legend">
      {items.map(i => (
        <li key={i.label} className="t-label c-secondary"><span className="legend-dot" data-series={i.series} aria-hidden="true" />{i.label}</li>
      ))}
    </ul>
  )
}

export function QuickAction({ icon: Icon, label, selected, ...rest }: { icon: LucideIcon; label: string; selected?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="quick-action" data-selected={selected || undefined} {...rest}>
      <span className="quick-action-circle"><Icon size={22} strokeWidth={STROKE} aria-hidden="true" /></span>
      <span className="t-label-small c-secondary">{label}</span>
    </button>
  )
}

export function Dialog({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  const id = `dlg-${title.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <dialog ref={ref} className="dialog" data-wide={wide || undefined} onClose={onClose} onClick={e => { if (e.target === ref.current) onClose() }} aria-labelledby={id}>
      {open && (
        <>
          <div className="dialog-head">
            <h2 id={id} className="t-h2">{title}</h2>
            <IconButton icon={X} label="Close" look="glass" onClick={onClose} />
          </div>
          {children}
        </>
      )}
    </dialog>
  )
}

export function Done({ children }: { children: ReactNode }) {
  return <p className="done t-label"><Check size={16} strokeWidth={STROKE} aria-hidden="true" />{children}</p>
}
