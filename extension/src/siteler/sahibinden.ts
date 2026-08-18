import { parseDetail } from '../parseDetail'
import { parseListRows, SATIR_SECICI } from '../parseList'
import type { SiteAdaptoru } from './tip'
import kayit from './kayit.json'

const k = kayit.find(s => s.ad === 'sahibinden')!

export const sahibinden: SiteAdaptoru = {
  ad: k.ad,
  kok: k.kok,
  satirSecici: SATIR_SECICI,
  satirId: el => el.getAttribute('data-id'),
  sayfaTipi(doc) {
    if (doc.querySelector('#classifiedDetail')) return 'detay'
    // klasik / viewType=List / viewType=Gallery — üçü de aynı liste akışından geçer
    if (doc.querySelector(SATIR_SECICI)) return 'liste'
    return null
  },
  detayOku: (doc, url) => parseDetail(doc, url),
  listeSatirlari: doc => parseListRows(doc)
}
