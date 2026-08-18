import { describe, it, expect } from 'vitest'
import { trTarihAyristir, ilanYasiGun, ilanYasiMetni, tarihAlanlariniAyikla } from '../src/ilanTarihi'

const BUGUN = new Date(2026, 7, 15) // 15 Ağustos 2026

describe('trTarihAyristir', () => {
  it('Türkçe uzun tarihi ayrıştırır', () => {
    expect(trTarihAyristir('01 Ağustos 2026')?.getTime()).toBe(new Date(2026, 7, 1).getTime())
    expect(trTarihAyristir('5 Aralık 2025')?.getTime()).toBe(new Date(2025, 11, 5).getTime())
  })
  it('şapkasız/küçük harfli varyantları kabul eder', () => {
    expect(trTarihAyristir('01 agustos 2026')).not.toBe(null)
    expect(trTarihAyristir('01 MAYIS 2026')).not.toBe(null)
  })
  it('tanınmayan biçimde null', () => {
    expect(trTarihAyristir('2026-08-01')).toBe(null)
    expect(trTarihAyristir('01 Foo 2026')).toBe(null)
    expect(trTarihAyristir('32 Ağustos 2026')).toBe(null)
  })
})

describe('ilanYasiGun', () => {
  it('geçmiş tarihi gün farkına çevirir', () => {
    expect(ilanYasiGun('01 Ağustos 2026', BUGUN)).toBe(14)
  })
  it('gelecek tarihi 0 sayar (veri hatası, bayrak sebebi değil)', () => {
    expect(ilanYasiGun('01 Eylül 2026', BUGUN)).toBe(0)
  })
  it('tanımsız/bozuk girdide null', () => {
    expect(ilanYasiGun(undefined, BUGUN)).toBe(null)
    expect(ilanYasiGun('bilinmiyor', BUGUN)).toBe(null)
  })
})

describe('ilanYasiMetni', () => {
  it('gün ve ay biçimlerini üretir', () => {
    expect(ilanYasiMetni(0)).toBe('bugün yayınlandı')
    expect(ilanYasiMetni(14)).toBe('14 gündür yayında')
    expect(ilanYasiMetni(35)).toBe('1 aydır yayında')
    expect(ilanYasiMetni(95)).toBe('3 aydır yayında')
    expect(ilanYasiMetni(null)).toBe(null)
  })
})

describe('tarihAlanlariniAyikla', () => {
  it('ham tarihi ayırır, diğer alanları korur', () => {
    const { temiz, ilanTarihi } = tarihAlanlariniAyikla({
      'İlan Tarihi': '01 Ağustos 2026', 'Motor Gücü': '120 hp', 'Renk': 'Beyaz'
    })
    expect(ilanTarihi).toBe('01 Ağustos 2026')
    expect(temiz).toEqual({ 'Motor Gücü': '120 hp', 'Renk': 'Beyaz' })
    expect('İlan Tarihi' in temiz).toBe(false)
  })
  it('tarih alanı yoksa her şeyi korur', () => {
    const { temiz, ilanTarihi } = tarihAlanlariniAyikla({ 'Renk': 'Mavi' })
    expect(ilanTarihi).toBeUndefined()
    expect(temiz).toEqual({ 'Renk': 'Mavi' })
  })
})
