import type { FiyatIstatistik } from './schemas'

export function medyan(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function quantile(xs: number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b)
  const i = (s.length - 1) * p
  const lo = Math.floor(i), hi = Math.ceil(i)
  return s[lo] + (s[hi] - s[lo]) * (i - lo)
}

export function yuzdelik(xs: number[], v: number): number {
  const s = [...xs].sort((a, b) => a - b)
  for (let i = 0; i < s.length; i++) {
    if (s[i] >= v) {
      if (s[i] === v) {
        return Math.round((i / (s.length - 1)) * 100)
      } else if (i === 0) {
        return 0
      } else {
        const ratio = (v - s[i - 1]) / (s[i] - s[i - 1])
        const position = i - 1 + ratio
        return Math.round((position / (s.length - 1)) * 100)
      }
    }
  }
  return 100
}

export function pazarlikTabani(fiyat: number, medyanF: number): number {
  return fiyat > medyanF ? medyanF : Math.round(fiyat * 0.95)
}

export function clampPazarlik(aiHedef: number | null, taban: number): number {
  if (aiHedef == null) return taban
  return Math.min(Math.max(aiHedef, taban * 0.95), taban * 1.05)
}

// Dağılımın anlamlı sayılması için gereken en az örnek. Uzantıdaki YETER ile aynı sayı;
// havuz da bu eşiği kullanıyor, iki yerde farklı olursa "5 var ama istatistik yok" çıkar.
export const YETER = 5

export function fiyatIstatistik(benzer: number[], fiyat: number): FiyatIstatistik | null {
  if (benzer.length < YETER) return null
  return {
    medyan: medyan(benzer), p25: quantile(benzer, 0.25), p75: quantile(benzer, 0.75),
    n: benzer.length, yuzdelik: yuzdelik(benzer, fiyat)
  }
}
