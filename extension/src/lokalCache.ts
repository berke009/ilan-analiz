import type { AnalysisResult } from 'shared'
import { tarayici } from './tarayici'

const TTL_MS = 24 * 3600_000
const anahtar = (ilanId: string, fiyat: number) => `analiz:${ilanId}:${fiyat}`

export async function lokalSonucGet(ilanId: string, fiyat: number): Promise<AnalysisResult | null> {
  const k = anahtar(ilanId, fiyat)
  const v = (await tarayici.storage.local.get(k))[k]
  if (!v || Date.now() - v.ts > TTL_MS) return null
  return v.sonuc
}

export async function lokalSonucSet(ilanId: string, fiyat: number, sonuc: AnalysisResult): Promise<void> {
  await tarayici.storage.local.set({ [anahtar(ilanId, fiyat)]: { sonuc, ts: Date.now() } })
}
