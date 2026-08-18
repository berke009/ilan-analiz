import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { arabam } from '../src/siteler/arabam'
import { adaptorSec } from '../src/siteler'

const fixture = (ad: string) =>
  new DOMParser().parseFromString(readFileSync(join(__dirname, 'fixtures', ad), 'utf8'), 'text/html')

const DETAY = 'arabam-detay-otomobil.html'
const LISTE = 'arabam-liste-otomobil.html'
const URL_DETAY = 'https://www.arabam.com/ilan/galeriden-satilik-volkswagen-polo-1-2-tsi-lounge/rcs/90000013'

describe('arabam · sayfa tespiti', () => {
  it('detay ve liste ayırt edilir, alakasız sayfa null', () => {
    expect(arabam.sayfaTipi(fixture(DETAY))).toBe('detay')
    expect(arabam.sayfaTipi(fixture(LISTE))).toBe('liste')
    expect(arabam.sayfaTipi(new DOMParser().parseFromString('<p>boş</p>', 'text/html'))).toBe(null)
  })
})

describe('arabam · detay ayrıştırma', () => {
  const ilan = arabam.detayOku(fixture(DETAY), URL_DETAY)!

  it('temel alanlar okunur', () => {
    expect(ilan.ilanId).toBe('90000013')
    expect(ilan.marka).toBe('Volkswagen')
    expect(ilan.seri).toBe('Polo')
    expect(ilan.model).toBe('1.2 TSi Lounge')
    expect(ilan.yil).toBe(2016)
    expect(ilan.km).toBe(191500)
    expect(ilan.yakit).toBe('Benzin')
    expect(ilan.vites).toBe('Otomatik')
    expect(ilan.kimden).toBe('Galeriden')
    expect(ilan.fiyat).toEqual({ tutar: 1175000, paraBirimi: 'TL' })
  })

  it('kategori ve arama yolları kırıntıdan gelir', () => {
    expect(ilan.kategori).toBe('Otomobil')
    expect(ilan.modelAramaPath).toBe('/ikinci-el/otomobil/volkswagen-polo-1-2-tsi-lounge')
    expect(ilan.ustAramaPath).toBe('/ikinci-el/otomobil/volkswagen-polo-1-2-tsi')
  })

  it('açıklama metni alınır — satıcının yazdığı hasar bilgisi burada', () => {
    expect(ilan.aciklamaText).toContain('Hasar kaydı : 1.340 tl')
  })

  // arabam'da ikili "Ağır Hasar Kayıtlı" alanı YOK; tramer ayrı bölümde tutar olarak
  // veriliyor. Uydurmak yerine bilinmiyor demek doğrusu.
  it('agirHasarKayitli uydurulmaz, tramer ek alana yazılır', () => {
    expect(ilan.agirHasarKayitli).toBe(null)
    expect(ilan.ekAlanlar['Tramer']).toBe('Belirtilmemiş')
    expect(ilan.ekAlanlar['Boya-değişen']).toBe('2 boyalı, 2 lokal boyalı')
  })

  it('eşleşmeyen etiketler ekAlanlar’a düşer, kaybolmaz', () => {
    expect(ilan.ekAlanlar['Kasa Tipi']).toBe('Hatchback/5')
    expect(ilan.ekAlanlar['Motor Gücü']).toBe('76 - 100 HP')
    expect(ilan.ekAlanlar['İlan Tarihi']).toBe('18 Ağustos 2026')
  })
})

describe('arabam · liste ayrıştırma', () => {
  const satirlar = arabam.listeSatirlari(fixture(LISTE))

  it('tüm satırlar okunur', () => {
    expect(satirlar).toHaveLength(4)
    expect(satirlar.map(s => s.ilanId)).toEqual(['90000013', '90000012', '90000010', '90000011'])
  })

  it('fiyat kendi sınıfından okunur, yıl ve km birbirine karışmaz', () => {
    const [ilk, ikinci] = satirlar
    expect(ilk!.fiyat).toEqual({ tutar: 1175000, paraBirimi: 'TL' })
    expect(ilk!.yil).toBe(2016)
    expect(ilk!.km).toBe(191500)
    expect(ikinci!.yil).toBe(2014)
    expect(ikinci!.km).toBe(105011)
  })

  // Km'si yıla benzeyen satır (2022 model, 49.661 km) ikisini karıştırmanın klasik yeri
  it('yeni model + düşük km satırında yıl/km ayrımı bozulmaz', () => {
    const s = satirlar.find(x => x.ilanId === '90000010')!
    expect(s.yil).toBe(2022)
    expect(s.km).toBe(49661)
  })

  it('model, başlık, il ve ilan bağlantısı alınır', () => {
    const s = satirlar[0]!
    expect(s.model).toBe('Volkswagen Polo 1.2 TSi Lounge')
    expect(s.baslik).toContain('ÖRNEK GALERİDEN')
    expect(s.il).toBe('Bursa')
    expect(s.url).toContain('/ilan/')
    expect(s.url).toContain('90000013')
  })
})

describe('adaptör seçimi', () => {
  it('host’a göre doğru adaptör gelir', () => {
    expect(adaptorSec('www.arabam.com')?.ad).toBe('arabam')
    expect(adaptorSec('arabam.com')?.ad).toBe('arabam')
    expect(adaptorSec('www.sahibinden.com')?.ad).toBe('sahibinden')
    expect(adaptorSec('baska-site.com')).toBe(null)
  })
})
