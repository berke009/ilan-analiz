import { describe, it, expect } from 'vitest'
import { loadFixture } from './helpers'
import { sahibinden } from '../src/siteler/sahibinden'
import { parseDetail } from '../src/parseDetail'
import { trSayi, parseFiyat } from '../src/parseCommon'

describe('parseCommon', () => {
  it('türkçe sayı', () => {
    expect(trSayi('178.000')).toBe(178000)
    expect(trSayi('yok')).toBe(null)
  })
  it('fiyat', () => {
    expect(parseFiyat('2.985.000 TL')).toEqual({ tutar: 2985000, paraBirimi: 'TL' })
    expect(parseFiyat('50.000 EUR')?.paraBirimi).toBe('EUR')
    expect(parseFiyat('')).toBe(null)
  })
})

describe('sayfa tespiti (sahibinden adaptörü)', () => {
  it('detay ve liste ayrımı', () => {
    expect(sahibinden.sayfaTipi(loadFixture('detay-otomobil.html'))).toBe('detay')
    expect(sahibinden.sayfaTipi(loadFixture('liste-otomobil.html'))).toBe('liste')
    expect(sahibinden.sayfaTipi(new DOMParser().parseFromString('<p>boş</p>', 'text/html'))).toBe(null)
  })
})

// Gerçek fixture ilanlarındaki alanlar (bkz. fixtures/selectors.md + detay-*.html)
// url'ler gerçek sahibinden biçimini taklit eder: slug İÇİNDE de rakam grupları var
// (1-6, 125, 350l, 2-0 gibi) — regex'in slug'daki kısa rakamlara değil, SONDAKİ
// gerçek ilan id'sine kilitlendiğini kanıtlar.
const beklenen = {
  'detay-otomobil.html': {
    url: 'https://www.sahibinden.com/ilan/vasita-otomobil-fiat-egea-1-6-multijet-lounge-90000004/detay',
    ilanId: '90000004',
    marka: 'Fiat', seri: 'Egea', model: '1.6 Multijet Lounge', yil: 2019, km: 112000,
    yakit: 'Dizel', vites: 'Manuel', agirHasarKayitli: 'Hayır', kimden: 'Sahibinden',
    tutar: 875000, il: 'İzmir', ilce: 'Bornova', kategori: 'Otomobil',
    modelAramaPath: '/fiat-egea-1-6-multijet'
  },
  'detay-suv.html': {
    url: 'https://www.sahibinden.com/ilan/vasita-arazi-suv-pickup-hyundai-tucson-1-6-crdi-elite-90000005/detay',
    ilanId: '90000005',
    marka: 'Hyundai', seri: 'Tucson', model: '1.6 CRDI Elite', yil: 2021, km: 68500,
    yakit: 'Dizel', vites: 'Otomatik', agirHasarKayitli: 'Hayır', kimden: 'Galeriden',
    tutar: 1985000, il: 'İstanbul', ilce: 'Kadıköy', kategori: 'Arazi, SUV & Pickup',
    modelAramaPath: '/hyundai-tucson-1-6-crdi'
  },
  'detay-motosiklet.html': {
    url: 'https://www.sahibinden.com/ilan/vasita-motosiklet-honda-pcx-125-abs-90000001/detay',
    ilanId: '90000001',
    marka: 'Honda', seri: 'PCX', model: '125 ABS', yil: 2020, km: 18200,
    yakit: 'Benzin', vites: 'Otomatik', agirHasarKayitli: 'Hayır', kimden: 'Sahibinden',
    tutar: 155000, il: 'Ankara', ilce: 'Çankaya', kategori: 'Motosiklet',
    modelAramaPath: '/honda-pcx-125'
  },
  'detay-minivan.html': {
    url: 'https://www.sahibinden.com/ilan/vasita-minivan-panelvan-ford-tourneo-courier-1-5-tdci-titanium-90000002/detay',
    ilanId: '90000002',
    marka: 'Ford', seri: 'Tourneo Courier', model: '1.5 TDCi Titanium', yil: 2018, km: 156000,
    yakit: 'Dizel', vites: 'Manuel', agirHasarKayitli: 'Evet', kimden: 'Sahibinden',
    tutar: 735000, il: 'Bursa', ilce: 'Nilüfer', kategori: 'Minivan & Panelvan',
    modelAramaPath: '/ford-tourneo-courier-1-5-tdci'
  },
  'detay-ticari.html': {
    url: 'https://www.sahibinden.com/ilan/vasita-ticari-ford-transit-350l-jumbo-2-0-ecoblue-90000003/detay',
    ilanId: '90000003',
    marka: 'Ford', seri: 'Transit', model: '350L Jumbo', yil: 2017, km: 245000,
    yakit: 'Dizel', vites: 'Manuel', agirHasarKayitli: 'Hayır', kimden: 'Galeriden',
    tutar: 985000, il: 'Konya', ilce: 'Selçuklu', kategori: 'Ticari Araçlar',
    modelAramaPath: '/ford-transit-350l'
  }
} as const

for (const [f, b] of Object.entries(beklenen)) {
  describe(`parseDetail ${f}`, () => {
    const ilan = parseDetail(loadFixture(f), b.url)
    it('kritik alanlar gerçek fixture değerleriyle eşleşir', () => {
      expect(ilan).not.toBe(null)
      expect(ilan!.ilanId).toBe(b.ilanId)
      expect(ilan!.baslik.length).toBeGreaterThan(5)
      expect(ilan!.fiyat).toEqual({ tutar: b.tutar, paraBirimi: 'TL' })
      expect(ilan!.marka).toBe(b.marka)
      expect(ilan!.seri).toBe(b.seri)
      expect(ilan!.model).toBe(b.model)
      expect(ilan!.yil).toBe(b.yil)
      expect(ilan!.km).toBe(b.km)
      expect(ilan!.yakit).toBe(b.yakit)
      expect(ilan!.vites).toBe(b.vites)
      expect(ilan!.agirHasarKayitli).toBe(b.agirHasarKayitli)
      expect(ilan!.kimden).toBe(b.kimden)
      expect(ilan!.il).toBe(b.il)
      expect(ilan!.ilce).toBe(b.ilce)
    })
    it('açıklama ve breadcrumb gerçek değerlerle eşleşir', () => {
      expect(ilan!.aciklamaText!.length).toBeGreaterThan(10)
      expect(ilan!.kategori).toBe(b.kategori)
      expect(ilan!.modelAramaPath).toBe(b.modelAramaPath)
    })
    it('kategoriye özgü alanlar ekAlanlar’a düşer', () => {
      expect(Object.keys(ilan!.ekAlanlar).length).toBeGreaterThan(0)
      expect(ilan!.ekAlanlar['Marka']).toBeUndefined()
    })
  })
}

describe('parseDetail ilanId kaynağı', () => {
  it('URL sonunda id yoksa DOM "İlan No" alanına düşer', () => {
    // slug'da rakam var ama ≥5 haneli sondaki id yok → regex eşleşmemeli
    const ilan = parseDetail(
      loadFixture('detay-otomobil.html'),
      'https://www.sahibinden.com/ilan/fiat-egea-1-6-multijet-lounge/detay'
    )
    expect(ilan!.ilanId).toBe('90000004') // fixture'daki "İlan No" li'sinden
  })
  it('slug içindeki kısa rakam gruplarını (1-6, 125...) ilan id sanmaz', () => {
    const ilan = parseDetail(loadFixture('detay-motosiklet.html'), beklenen['detay-motosiklet.html'].url)
    expect(ilan!.ilanId).not.toBe('125')
    expect(ilan!.ilanId).toBe('90000001')
  })
})

describe('breadcrumb (canlı yapı: .bc-item > a)', () => {
  const doc = loadFixture('detay-otomobil.html')
  const ilan = parseDetail(doc, 'https://www.sahibinden.com/ilan/vasita-90000014/detay')!

  it('en derin kırıntıyı model arama yolu yapar', () => {
    expect(ilan.modelAramaPath).toBe('/fiat-egea-1-6-multijet')
  })
  it('bir üst kırıntıyı yedek arama yolu olarak taşır', () => {
    expect(ilan.ustAramaPath).toBe('/fiat-egea')
  })
  it('kategori ikinci kırıntıdan gelir', () => {
    expect(ilan.kategori).toBe('Otomobil')
  })
  it('bc-tooltip içindeki kardeş model linklerini kırıntı sanmaz', () => {
    // fixture her li.bc-item içine bir de tooltip linki koyuyor; '> a' onları elemeli
    expect(doc.querySelectorAll('.bc-item .bc-tooltip a').length).toBeGreaterThan(0)
    expect(doc.querySelectorAll('.bc-item > a').length).toBe(5)
  })
})
