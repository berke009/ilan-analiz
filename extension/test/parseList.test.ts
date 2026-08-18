import { describe, it, expect } from 'vitest'
import { loadFixture } from './helpers'
import { parseListRows } from '../src/parseList'

describe('parseListRows liste-otomobil.html', () => {
  const satirlar = parseListRows(loadFixture('liste-otomobil.html'))
  it('en az 10 satır çıkarır', () => {
    expect(satirlar.length).toBeGreaterThanOrEqual(10)
  })
  it('satırlarda kritik alanlar var', () => {
    for (const s of satirlar.slice(0, 5)) {
      expect(s.ilanId).toMatch(/^\d+$/)
      expect(s.fiyat?.tutar).toBeGreaterThan(0)
      expect(s.yil).toBeGreaterThan(1980)
    }
  })
  it('marka ve seri fixture değerlerini popüle eder', () => {
    // First row: 90000014 should be Fiat Egea
    expect(satirlar[0].marka).toBe('Fiat')
    expect(satirlar[0].seri).toBe('Egea')
    expect(satirlar[0].ilanId).toBe('90000014')
    expect(satirlar[0].baslik).toBe('2019 Fiat Egea 1.6 Multijet Lounge')
    expect(satirlar[0].yil).toBe(2019)
    expect(satirlar[0].km).toBe(112000)
    expect(satirlar[0].il).toBe('İzmir')
    expect(satirlar[0].url).toBe('/ilan/vasita-90000014/detay')
  })
})

describe('parseListRows liste-suv.html', () => {
  const satirlar = parseListRows(loadFixture('liste-suv.html'))
  it('en az 10 satır çıkarır', () => {
    expect(satirlar.length).toBeGreaterThanOrEqual(10)
  })
  it('satırlarda kritik alanlar var', () => {
    for (const s of satirlar.slice(0, 5)) {
      expect(s.ilanId).toMatch(/^\d+$/)
      expect(s.fiyat?.tutar).toBeGreaterThan(0)
      expect(s.yil).toBeGreaterThan(1980)
    }
  })
  it('marka ve seri fixture değerlerini popüle eder', () => {
    // First row: 90000030 should be Hyundai Tucson
    expect(satirlar[0].marka).toBe('Hyundai')
    expect(satirlar[0].seri).toBe('Tucson')
    expect(satirlar[0].ilanId).toBe('90000030')
    expect(satirlar[0].yil).toBe(2021)
    expect(satirlar[0].km).toBe(68500)
    expect(satirlar[0].il).toBe('İstanbul')
  })
})

// Aşağıdaki iki görünüm 2026-08-15'te canlı sayfadan doğrulandı (bkz. fixtures/selectors.md).
describe('parseListRows liste-galeri.html (viewType=Gallery)', () => {
  const satirlar = parseListRows(loadFixture('liste-galeri.html'))

  it('galeri kartlarını okur ve iç <tr data-id> yüzünden ilanı iki kez saymaz', () => {
    expect(satirlar).toHaveLength(4)
    expect(new Set(satirlar.map(s => s.ilanId)).size).toBe(4)
  })

  it('yıl/km/il etiketli alanlardan çıkar', () => {
    const s = satirlar[0]
    expect(s.ilanId).toBe('90000007')
    expect(s.yil).toBe(1999)
    expect(s.km).toBe(85000)
    expect(s.il).toBe('İstanbul')
    expect(s.fiyat).toEqual({ tutar: 1558000, paraBirimi: 'TL' })
    expect(s.url).toBe('/ilan/vasita-90000007/detay')
    expect(s.baslik).toBe('Örnek İlan Başlığı Bir')
  })

  it('galeride marka/seri/model sütunu yok → null, satır yine de düşmez', () => {
    expect(satirlar[0].marka).toBe(null)
    expect(satirlar[0].seri).toBe(null)
    expect(satirlar[0].model).toBe(null)
  })

  it('TL dışı para birimini olduğu gibi verir (eleme akışın işi)', () => {
    expect(satirlar[3].fiyat).toEqual({ tutar: 32500, paraBirimi: 'EUR' })
  })
})

describe('parseListRows liste-satir.html (viewType=List)', () => {
  const satirlar = parseListRows(loadFixture('liste-satir.html'))

  it('yıl/km sütunu olmayan satırları atmaz, null bırakır', () => {
    expect(satirlar).toHaveLength(3)
    for (const s of satirlar) {
      expect(s.yil).toBe(null)
      expect(s.km).toBe(null)
      expect(s.marka).toBe(null)
      expect(s.fiyat?.tutar).toBeGreaterThan(0)
      expect(s.baslik).toBeTruthy()
    }
    expect(satirlar[0].il).toBe('İstanbul')
    expect(satirlar[1].url).toBe('/ilan/vasita-90000007/detay')
  })
})

describe('klasik görünüm model sütunu', () => {
  it('üçüncü etiket hücresi model olarak okunur', () => {
    const satirlar = parseListRows(loadFixture('liste-otomobil.html'))
    expect(satirlar[0].model).toBe('1.6 Multijet Lounge')
  })
})
