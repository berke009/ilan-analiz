import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ADAPTORLER, SITE_KAYDI, adaptorSec } from '../src/siteler'

// kayit.json manifest'i (content_scripts, host_permissions) üretiyor; ADAPTORLER ise
// çalışma zamanında kimin okuyacağını belirliyor. İkisi ayrışırsa hata SESSİZ olur:
// kayıtta olup adaptörü olmayan site => content script enjekte edilir, adaptorSec null
// döner, kullanıcı izni boşuna istenmiş olur. Tersi => adaptör hiç çalışmaz.
describe('site kaydı ve adaptörler ayrışmaz', () => {
  it('kayıttaki her sitenin adaptörü var', () => {
    for (const k of SITE_KAYDI) {
      expect(ADAPTORLER.find(a => a.ad === k.ad), `'${k.ad}' kayıtta var ama ADAPTORLER'de yok`).toBeTruthy()
    }
  })

  it('her adaptör kayıtlı — manifest izni olmadan adaptör çalışmaz', () => {
    for (const a of ADAPTORLER) {
      expect(SITE_KAYDI.find(k => k.ad === a.ad), `'${a.ad}' adaptörü var ama kayit.json'da yok`).toBeTruthy()
    }
  })

  it('adaptör kökü kayıtla aynı host, eşleşme deseni o hostu kapsıyor', () => {
    for (const a of ADAPTORLER) {
      const k = SITE_KAYDI.find(s => s.ad === a.ad)!
      expect(new URL(a.kok).host).toBe(new URL(k.kok).host)
      expect(k.eslesenler.some(e => e.includes(new URL(k.kok).host))).toBe(true)
      expect(adaptorSec(new URL(k.kok).host)?.ad).toBe(a.ad)
    }
  })
})

// Rozetler, satirSecici ile bulunan elemanın kimliğinin listeSatirlari'nın verdiği
// ilanId ile eşleşmesiyle basılıyor. İkisi ayrılırsa rozet SESSİZCE hiç çıkmaz:
// istisna yok, log yok, ilerleme widget'ı yine "4/4" deyip biter.
// Gerçekten oldu — listeAkisi sahibinden'in data-id'sini varsayıyordu, arabam
// data-imp-id kullanıyor; arabam liste sayfalarında tek rozet basılmadı.
describe('satirId ile listeSatirlari aynı kimliği verir', () => {
  const LISTE_FIXTURE: Record<string, string> = {
    sahibinden: 'liste-otomobil.html',
    arabam: 'arabam-liste-otomobil.html'
  }

  for (const a of ADAPTORLER) {
    it(`${a.ad} · her satır elemanı ayrıştırılan ilanId'ye çözülür`, () => {
      const dosya = LISTE_FIXTURE[a.ad]
      expect(dosya, `${a.ad} için liste fixture'ı tanımlı değil`).toBeTruthy()
      const doc = new DOMParser().parseFromString(
        readFileSync(join(__dirname, 'fixtures', dosya!), 'utf8'), 'text/html')

      const ayristirilan = a.listeSatirlari(doc).map(s => s.ilanId)
      const elemanlar = [...doc.querySelectorAll(a.satirSecici)]
      const kimlikler = elemanlar.map(el => a.satirId(el))

      expect(elemanlar.length).toBeGreaterThan(0)
      expect(kimlikler.filter(k => k === null), `${a.ad}: satirId bazı satırlarda null`).toHaveLength(0)
      // Rozet basılabilen satır sayısı, ayrıştırılan satır sayısıyla aynı olmalı
      expect(ayristirilan.filter(id => kimlikler.includes(id))).toHaveLength(ayristirilan.length)
    })
  }
})
