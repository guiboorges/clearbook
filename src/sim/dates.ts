// Calendar math on whole days (UTC day numbers), so results never depend on the time zone.

export type Day = number // days since 1970-01-01

const MS = 86_400_000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const day = (y: number, m: number, d: number): Day => Math.floor(Date.UTC(y, m, d) / MS)
export const fromDate = (t: Date): Day => day(t.getFullYear(), t.getMonth(), t.getDate())

export function parts(d: Day) {
  const t = new Date(d * MS)
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), wd: t.getUTCDay() }
}

export const key = (d: Day) => {
  const p = parts(d)
  return `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}
export const fromKey = (k: string): Day => {
  const [y, m, d] = k.split('-').map(Number)
  return day(y, m - 1, d)
}

export const monthStart = (d: Day) => { const p = parts(d); return day(p.y, p.m, 1) }
export const addMonths = (d: Day, n: number) => { const p = parts(d); return day(p.y, p.m + n, 1) }
export const daysInMonth = (d: Day) => addMonths(d, 1) - monthStart(d)
export const quarterOf = (d: Day) => Math.floor(parts(d).m / 3) // 0..3
export const quarterStart = (d: Day) => day(parts(d).y, quarterOf(d) * 3, 1)
// Monday-based weeks
export const weekStart = (d: Day) => d - ((parts(d).wd + 6) % 7)
export const isWeekday = (d: Day) => { const wd = parts(d).wd; return wd !== 0 && wd !== 6 }

export const monthName = (d: Day) => MONTHS[parts(d).m]
export const shortDate = (d: Day) => `${MONTHS[parts(d).m]} ${parts(d).d}`
