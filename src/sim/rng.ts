// Seeded randomness: the same seed always gives the same history, so values don't change on reload.

export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function rng(seed: number | string) {
  let a = typeof seed === 'string' ? hash(seed) : seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const between = (r: () => number, lo: number, hi: number) => lo + r() * (hi - lo)
export const pick = <T,>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)]
export const round = (v: number, step = 0.01) => Math.round(v / step) * step
