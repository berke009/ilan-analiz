import { describe, it, expect } from 'vitest'
import { ozellikCikar } from '../src/ozellik'

describe('ozellikCikar', () => {
  it.each([
    ['otomatik', 'otomatik'], ['dsg', 'otomatik'], ['dct', 'otomatik'], ['tiptronic', 'otomatik'],
    ['edc', 'otomatik'], ['eat', 'otomatik'], ['s-tronic', 'otomatik'], ['steptronic', 'otomatik'],
    ['manuel', 'manuel'], ['düz vites', 'manuel']
  ])('vites anahtar kelimesi: %s → %s', (kelime, beklenen) => {
    expect(ozellikCikar(`1.6 ${kelime}`).vites).toBe(beklenen)
  })

  it.each([
    ['dizel', 'dizel'], ['tdi', 'dizel'], ['crdi', 'dizel'], ['multijet', 'dizel'], ['bluehdi', 'dizel'],
    ['hdi', 'dizel'], ['cdi', 'dizel'], ['jtd', 'dizel'], ['dci', 'dizel'],
    ['benzin', 'benzin'], ['tsi', 'benzin'], ['tfsi', 'benzin'], ['gdi', 'benzin'], ['vti', 'benzin'], ['mpi', 'benzin'],
    ['lpg', 'lpg'], ['hibrit', 'hibrit'], ['hybrid', 'hibrit'], ['elektrik', 'elektrik']
  ])('yakıt anahtar kelimesi: %s → %s', (kelime, beklenen) => {
    expect(ozellikCikar(`1.6 ${kelime} motor`).yakit).toBe(beklenen)
  })

  it('bilinmeyen metin → null/null', () => {
    expect(ozellikCikar('sadece bir başlık metni')).toEqual({ vites: null, yakit: null })
  })

  it('null/undefined argümanlarla çökmez', () => {
    expect(ozellikCikar(null, undefined)).toEqual({ vites: null, yakit: null })
  })

  it('birden çok metin birleştirilir', () => {
    expect(ozellikCikar('1.6 Multijet', 'Otomatik vites')).toEqual({ vites: 'otomatik', yakit: 'dizel' })
  })

  it('karışık metinde ilk geçen eşleşme kazanır (benzin önce)', () => {
    // "benzin" 'benzin' idx 0'da, 'dizel' daha sonra geçiyor
    expect(ozellikCikar('benzin değil dizel motor').yakit).toBe('benzin')
  })

  it('karışık metinde ilk geçen eşleşme kazanır (dizel önce)', () => {
    expect(ozellikCikar('dizel değil benzin motor').yakit).toBe('dizel')
  })

  it('büyük harf / Türkçe karakter duyarsız (İ/I)', () => {
    expect(ozellikCikar('OTOMATİK vites, DİZEL yakıt')).toEqual({ vites: 'otomatik', yakit: 'dizel' })
  })
})

// Aşağıdaki iki kusur bağımsız doğrulama turunda gerçek modülle repro edildi.
describe('sözcük sınırı — kısa anahtarlar başka kelimenin içinde eşleşmemeli', () => {
  it('"Seat" markası aracı otomatik sanmamalı (eat ⊂ Seat)', () => {
    expect(ozellikCikar('1.6 TDI Style', 'Seat Leon 1.6 TDI Manuel').vites).toBe('manuel')
  })
  it('"Leather" / "Heated" de vitesi bozmamalı', () => {
    expect(ozellikCikar(null, 'Ford Focus Leather Manuel').vites).toBe('manuel')
    expect(ozellikCikar(null, 'BMW 320i Heated seats manuel').vites).toBe('manuel')
  })
  it('gerçek EAT şanzıman yine yakalanır', () => {
    expect(ozellikCikar(null, 'Peugeot 3008 1.5 BlueHDi EAT8').vites).toBe('otomatik')
  })
})

describe('Türkçe küçültme I harfini bozmamalı', () => {
  it('TDI / TSI / HDI / CDI / GDI dizel-benzin ayrımı çalışır', () => {
    expect(ozellikCikar(null, 'Volkswagen Passat 1.6 TDI').yakit).toBe('dizel')
    expect(ozellikCikar(null, 'Volkswagen Golf 1.4 TSI').yakit).toBe('benzin')
    expect(ozellikCikar(null, 'Peugeot 308 1.6 HDI').yakit).toBe('dizel')
    expect(ozellikCikar(null, 'Mercedes C 220 CDI').yakit).toBe('dizel')
    expect(ozellikCikar(null, 'Hyundai i20 1.4 GDI').yakit).toBe('benzin')
  })
  it('noktalı İ ile yazılmış Türkçe değerler de tutar', () => {
    expect(ozellikCikar('DİZEL').yakit).toBe('dizel')
    expect(ozellikCikar('Dizel').yakit).toBe('dizel')
  })
  it('TIPTRONIC otomatik olarak tanınır', () => {
    expect(ozellikCikar(null, 'Audi A4 2.0 TFSI TIPTRONIC').vites).toBe('otomatik')
  })
})
