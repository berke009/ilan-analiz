import type { SiteAdaptoru, SiteKaydi } from './tip'
import { sahibinden } from './sahibinden'
import { arabam } from './arabam'
import kayit from './kayit.json'

export type { SiteAdaptoru, SiteKaydi }
export const SITE_KAYDI = kayit as SiteKaydi[]
export const ADAPTORLER: SiteAdaptoru[] = [sahibinden, arabam]

// Hangi sitedeyiz? Eşleşme kayıt dosyasındaki host'tan çıkarılır ki manifest ile
// çalışma zamanı ASLA ayrışmasın — ikisi de aynı kaynaktan besleniyor.
export function adaptorSec(host: string): SiteAdaptoru | null {
  for (const a of ADAPTORLER) {
    const kayitliHost = new URL(a.kok).host
    if (host === kayitliHost || host === kayitliHost.replace(/^www\./, '')) return a
  }
  return null
}
