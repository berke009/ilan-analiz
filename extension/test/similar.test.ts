import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { filtreleBenzer, eslesenSatirlar, benzerIlanlarBul, listeSatirlariKaydet, listeDepo, depoAnahtari, type ListeDepo } from '../src/similar'
import { parseListRows } from '../src/parseList'
import type { ListRow } from 'shared'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const satir = (id: string, yil: number, fiyat: number, birim = 'TL'): any => ({
  ilanId: id, url: null, marka: null, seri: null, model: null, baslik: 'x',
  yil, km: 1, fiyat: { tutar: fiyat, paraBirimi: birim }, il: null
})

// Bellek içi depo. Gerçek depodan farkı yok: her ikisi de yalnız okuma/yazma yapar,
// ağa ÇIKMAZ — bu dosyada ağ olmadığı ayrıca test ediliyor.
const SITE = 'testsite'
function sahteDepo(baslangic: Record<string, ListRow[]> = {}): ListeDepo {
  // Anahtarlar üretimde site önekiyle yazılıyor; test de aynı üreteci kullanmalı
  const m = new Map(Object.entries(baslangic).map(([y, v]) => [depoAnahtari(SITE, y), v]))
  return {
    get: async k => m.get(k) ?? null,
    set: async (k, v) => { m.set(k, v) }
  }
}

const ilan: any = {
  ilanId: '999', modelAramaPath: '/fiat-egea', ustAramaPath: null, yil: 2020,
  marka: 'Fiat', seri: 'Egea', model: null, fiyat: { tutar: 1000000, paraBirimi: 'TL' }
}

const satirHtml = (id: string, yil: number, fiyat: number) => `<tr data-id="${id}">
  <td class="searchResultsTagAttributeValue">Fiat</td>
  <td class="searchResultsTagAttributeValue">Egea</td>
  <td class="searchResultsTitleValue"><a class="classifiedTitle" href="/ilan/vasita-${id}/detay">${yil} Fiat Egea</a></td>
  <td class="searchResultsAttributeValue">${yil}</td>
  <td class="searchResultsAttributeValue">10.000</td>
  <td class="searchResultsPriceValue">${fiyat} TL</td>
  <td class="searchResultsDateValue">05 Şubat</td>
  <td class="searchResultsLocationValue">İzmir<br>Bornova</td>
</tr>`
const listeHtml = (rows: string[]) => `<table id="searchResultsTable"><tbody>${rows.join('')}</tbody></table>`
const ayristir = (html: string): ListRow[] =>
  parseListRows(new DOMParser().parseFromString(html, 'text/html'))

describe('ağ erişimi yok', () => {
  // Bu ürünün kırmızı çizgisi: karşılaştırma verisi YALNIZ kullanıcının açtığı
  // sayfadan gelir. Buraya bir fetch sızarsa test patlar.
  let eskiFetch: any
  beforeEach(() => {
    eskiFetch = globalThis.fetch
    globalThis.fetch = (() => { throw new Error('AĞ İSTEĞİ YAPILDI — kırmızı çizgi ihlali') }) as any
  })
  afterEach(() => { globalThis.fetch = eskiFetch })

  it('depoda veri varken sonuç üretir ve ağa çıkmaz', async () => {
    const satirlar = ayristir(readFileSync(join(__dirname, 'fixtures', 'liste-otomobil.html'), 'utf8'))
    const r = await benzerIlanlarBul({ ...ilan, yil: 2020 }, sahteDepo({ '/fiat-egea': satirlar }), SITE)
    expect(r).not.toBeNull()
    expect(r!.fiyatlar).toHaveLength(13) // 16 satır, 2016+2017 (3 satır) bandın dışında
  })

  it('depo boşken null döner ve ağa çıkmaz — doğrudan ilana düşen kullanıcı', async () => {
    expect(await benzerIlanlarBul({ ...ilan, yil: 2020 }, sahteDepo(), SITE)).toBeNull()
  })
})

describe('filtreleme', () => {
  it('TL + yıl bandı + kendisi hariç', () => {
    const satirlar = [satir('1', 2020, 100), satir('2', 2019, 200), satir('3', 2025, 300), satir('999', 2020, 400), satir('4', 2021, 500, 'EUR')]
    expect(filtreleBenzer(satirlar, 2020, 2, '999')).toEqual([100, 200])
  })
})

describe('örneklem merdiveni', () => {
  it('±2 yetersiz, ±4 yeterli → aynı satırlar üzerinden genişletir', async () => {
    const satirlar = ayristir(listeHtml([
      satirHtml('b1', 2020, 500000), satirHtml('b2', 2019, 510000), satirHtml('b3', 2021, 520000),
      satirHtml('b4', 2016, 530000), satirHtml('b5', 2024, 540000)
    ]))
    const r = await benzerIlanlarBul({ ...ilan, yil: 2020 }, sahteDepo({ '/fiat-egea': satirlar }), SITE)
    expect(r!.fiyatlar).toEqual([500000, 510000, 520000, 530000, 540000])
  })

  it('±4 bile yetersiz → null', async () => {
    const satirlar = ayristir(listeHtml([satirHtml('c1', 2005, 500000), satirHtml('c2', 2030, 510000)]))
    expect(await benzerIlanlarBul({ ...ilan, yil: 2020 }, sahteDepo({ '/fiat-egea': satirlar }), SITE)).toBeNull()
  })

  it('derin yol yetersizse bir üst arama yoluna düşer', async () => {
    const az = ayristir(listeHtml([satirHtml('a1', 2020, 900000), satirHtml('a2', 2020, 900000)]))
    const cok = ayristir(listeHtml([1, 2, 3, 4, 5, 6].map(i => satirHtml(`b${i}`, 2020, 900000 + i * 1000))))
    const r = await benzerIlanlarBul(
      { ...ilan, modelAramaPath: '/fiat-egea-1-4-fire', ustAramaPath: '/fiat-egea', yil: 2020 },
      sahteDepo({ '/fiat-egea-1-4-fire': az, '/fiat-egea': cok }), SITE
    )
    expect(r!.satirlar).toHaveLength(6)
  })

  it('yıl bilinmiyorsa hiç bakmaz', async () => {
    expect(await benzerIlanlarBul({ ...ilan, yil: null }, sahteDepo(), SITE)).toBeNull()
  })
})

describe('eslesenSatirlar', () => {
  const hedefIlan: any = { ilanId: '999', yil: 2020, model: '1.6 Multijet Otomatik', baslik: 'Fiat Egea', vites: null, yakit: null }

  it('vites uyuşmazlığı olan satır elenir', () => {
    const satirlar = [satir('u1', 2020, 500000), { ...satir('u2', 2020, 510000), baslik: '1.6 Multijet Manuel' }]
    expect(eslesenSatirlar(satirlar, hedefIlan, 2).map(s => s.ilanId)).toEqual(['u1'])
  })
  it('adayın özelliği bilinmiyorsa elenmez', () => {
    expect(eslesenSatirlar([satir('u3', 2020, 500000)], hedefIlan, 2).map(s => s.ilanId)).toEqual(['u3'])
  })
  it('vites uyumlu satır tutulur', () => {
    const satirlar = [{ ...satir('u4', 2020, 500000), baslik: '1.6 Multijet Otomatik' }]
    expect(eslesenSatirlar(satirlar, hedefIlan, 2).map(s => s.ilanId)).toEqual(['u4'])
  })
})

describe('listeDepo (chrome.storage)', () => {
  let kutu: Record<string, any>
  beforeEach(() => {
    kutu = {}
    ;(globalThis as any).chrome = {
      storage: { local: {
        get: async (k: string) => ({ [k]: kutu[k] }),
        set: async (o: Record<string, any>) => { Object.assign(kutu, o) }
      } }
    }
  })
  afterEach(() => { delete (globalThis as any).chrome })

  it('yazılan satırlar aynı yoldan okunur', async () => {
    const d = listeDepo()
    await listeSatirlariKaydet(SITE, '/fiat-egea', [satir('1', 2020, 100)], d)
    expect((await d.get(depoAnahtari(SITE, '/fiat-egea')))!.map(s => s.ilanId)).toEqual(['1'])
  })

  it('boş liste yazılmaz — sayfa okunamadıysa iyi veriyi ezmesin', async () => {
    const d = listeDepo()
    await listeSatirlariKaydet(SITE, '/fiat-egea', [satir('1', 2020, 100)], d)
    await listeSatirlariKaydet(SITE, '/fiat-egea', [], d)
    expect(await d.get(depoAnahtari(SITE, '/fiat-egea'))).not.toBeNull()
  })

  it('24 saatten eski kayıt okunmaz', async () => {
    kutu['listeDepo'] = { '/eski': { satirlar: [satir('1', 2020, 100)], ts: Date.now() - 25 * 3600_000 } }
    expect(await listeDepo().get('/eski')).toBeNull()
  })

  it('en fazla 12 yol saklanır, en eskiler düşer', async () => {
    const d = listeDepo()
    for (let i = 0; i < 15; i++) {
      // ts çakışmasın diye kaydı elle geriye tarihliyoruz; sıralama ts'e göre
      await listeSatirlariKaydet(SITE, `/yol-${i}`, [satir(String(i), 2020, 100)], d)
      kutu['listeDepo'][depoAnahtari(SITE, `/yol-${i}`)].ts = Date.now() - (15 - i) * 1000
    }
    const yollar = Object.keys(kutu['listeDepo'])
    expect(yollar).toHaveLength(12)
    expect(yollar).toContain(depoAnahtari(SITE, '/yol-14'))
    expect(yollar).not.toContain(depoAnahtari(SITE, '/yol-0'))
  })
})

// Çok siteli mimaride en sinsi hata: iki sitede aynı yol (/otomobil) çakışıp bir
// sitenin satırları öbürünün fiyat istatistiğine karışır. Anahtar site önekli.
describe('siteler birbirine karışmaz', () => {
  it('aynı yol iki sitede ayrı saklanır', async () => {
    const kutu: Record<string, any> = {}
    ;(globalThis as any).chrome = {
      storage: { local: {
        get: async (k: string) => ({ [k]: kutu[k] }),
        set: async (o: Record<string, any>) => { Object.assign(kutu, o) }
      } }
    }
    try {
      const d = listeDepo()
      await listeSatirlariKaydet('siteA', '/otomobil', [satir('a1', 2020, 100)], d)
      await listeSatirlariKaydet('siteB', '/otomobil', [satir('b1', 2020, 200)], d)
      expect((await d.get(depoAnahtari('siteA', '/otomobil')))!.map(s => s.ilanId)).toEqual(['a1'])
      expect((await d.get(depoAnahtari('siteB', '/otomobil')))!.map(s => s.ilanId)).toEqual(['b1'])
    } finally { delete (globalThis as any).chrome }
  })

  it('bir sitenin ilanı diğer sitenin satırlarıyla karşılaştırılmaz', async () => {
    const satirlar = ayristir(listeHtml([1, 2, 3, 4, 5, 6].map(i => satirHtml(`x${i}`, 2020, 900000))))
    const depo = sahteDepo({ '/fiat-egea': satirlar })   // SITE önekiyle yazıldı
    expect(await benzerIlanlarBul({ ...ilan, yil: 2020 }, depo, 'baskaSite')).toBeNull()
  })
})
