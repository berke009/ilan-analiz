import type { AnalysisResult } from 'shared'
import { tarayici } from './tarayici'

const TTL_MS = 24 * 3600_000
const anahtar = (ilanId: string, fiyat: number) => `analiz:${ilanId}:${fiyat}`

// paylasim: sonuç paylaşılan önbellekten geldiyse kaynağı da SAKLANIR. Yalnız
// sonucu saklamak, ilanı ikinci kez açan kullanıcıya aynı metni "kendi analizi"
// gibi göstermek olurdu — beyan ilk gösterimde doğru, ikincisinde yanlış olamaz.
export type LokalKayit = { sonuc: AnalysisResult; paylasim?: { ts: number } }

export async function lokalSonucGet(ilanId: string, fiyat: number): Promise<LokalKayit | null> {
  const k = anahtar(ilanId, fiyat)
  const v = (await tarayici.storage.local.get(k))[k]
  if (!v || Date.now() - v.ts > TTL_MS) return null
  return { sonuc: v.sonuc, paylasim: v.paylasim }
}

export async function lokalSonucSet(
  ilanId: string, fiyat: number, sonuc: AnalysisResult, paylasim?: { ts: number }
): Promise<void> {
  await tarayici.storage.local.set({ [anahtar(ilanId, fiyat)]: { sonuc, paylasim, ts: Date.now() } })
}
