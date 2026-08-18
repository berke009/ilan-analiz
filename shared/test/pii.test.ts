import { describe, it, expect } from 'vitest'
import { maskeleMetin, maskeleIlan } from '../src/pii'

describe('telefon', () => {
  it('yaygın yazımları maskeler', () => {
    for (const t of [
      '0532 123 45 67', '05321234567', '+90 532 123 45 67', '+905321234567',
      '0090 532 123 45 67', '532 123 45 67', '0532.123.45.67', '0532-123-45-67',
      '(0532) 123 45 67', '0 532 123 45 67', '0212 555 44 33'
    ]) expect(maskeleMetin(`Bilgi için ${t} arayınız`), t).toBe('Bilgi için [telefon] arayınız')
  })
  it('harfle yazılmış numarayı maskeler', () => {
    expect(maskeleMetin('sıfır beş üç iki bir iki üç dört beş altı yedi den ulaşın'))
      .toBe('[telefon] den ulaşın')
  })
  it('YANLIŞ POZİTİF: araç sayıları telefon değil', () => {
    for (const t of [
      '1.6 TDI 190 HP', '150.000 km', '2015 model 145.000 km', '1.550.000 TL',
      '2015 150.000', '50.000 90.000', '450.000 500.000 arası',
      '4x4 16 inç jant', '205 55 R16', '1598 cc', '2.0 TDI 170 bg',
      '05.12.2019 tarihinde', '12.03.2019 - 15.04.2020', 'Şasi WVWZZZ1KZAW123456',
      'bir milyon dört yüz elli bin TL'
    ]) expect(maskeleMetin(t), t).toBe(t)
  })
})

describe('e-posta', () => {
  it('maskeler', () => {
    expect(maskeleMetin('ornek.satici_92@ornek-galeri.example yazın')).toBe('[e-posta] yazın')
    expect(maskeleMetin('info @ galeri.com')).toBe('[e-posta]')
  })
  it('YANLIŞ POZİTİF: alan adı olmayan sosyal hesap eşleşmez', () => {
    expect(maskeleMetin('instagram @galeri_x')).toBe('instagram @galeri_x')
  })
})

describe('IBAN', () => {
  it('maskeler', () => {
    expect(maskeleMetin('TR33 0006 1005 1978 6457 8413 26')).toBe('[iban]')
    expect(maskeleMetin('TR330006100519786457841326 hesabı')).toBe('[iban] hesabı')
  })
  it('YANLIŞ POZİTİF: TR plaka ibaresi eşleşmez', () => {
    expect(maskeleMetin('TR 34 plakalı')).toBe('TR 34 plakalı')
  })
})

describe('TCKN', () => {
  it('geçerli kimlik numarasını maskeler', () => {
    expect(maskeleMetin('TC 11111111110 ile')).toBe('TC [tckn] ile')
    expect(maskeleMetin('11111111110')).toBe('[tckn]')
  })
  it('YANLIŞ POZİTİF: doğrulama basamağı tutmayan 11 hane korunur', () => {
    expect(maskeleMetin('12345678901')).toBe('12345678901')
    expect(maskeleMetin('İlan No 90000000123')).toBe('İlan No 90000000123')
  })
  it('YANLIŞ POZİTİF: ayıraçlı fiyat/km 11 haneye ulaşmaz', () => {
    expect(maskeleMetin('1.550.000 TL 150.000 km')).toBe('1.550.000 TL 150.000 km')
  })
})

describe('plaka', () => {
  it('geçerli biçimleri maskeler', () => {
    for (const t of ['34 ABC 12', '34ABC12', '06 AB 1234', '35 A 1234', '41 KL 555'])
      expect(maskeleMetin(`Araç ${t} plakalı`), t).toBe('Araç [plaka] plakalı')
  })
  // BİLİNÇLİ TAVAN: küçük harfli plaka kaçar. Karşılığında "<sayı> <türkçe kelime> <sayı>"
  // yanlış pozitif SINIFININ tamamı kapanıyor (aşağıdaki test). Kara listeyle kovalamak
  // sonsuza kadar sızdırıyordu; büyük harf kuralı genel ve bedava.
  it('BİLİNÇLİ: küçük harfli plaka maskelenmez', () => {
    expect(maskeleMetin('34 abc 123')).toBe('34 abc 123')
  })
  it('YANLIŞ POZİTİF: geçersiz harf/rakam kombinasyonu eşleşmez', () => {
    for (const t of ['205 55 R16', '1.6 16V 110 bg', '34 AB', '81 A 12', 'jant 17 R 45'])
      expect(maskeleMetin(t), t).toBe(t)
  })
  // Bu sınıf canlıda motor hacmini ve garanti/taksit şartlarını siliyordu; ikisi de
  // analiz rubriğinde puanlanan bilgi (açıklama kalitesi %10).
  it('YANLIŞ POZİTİF: birim kelimeler ve motor supap yazımı eşleşmez', () => {
    for (const t of [
      '1.6 16V 1598 cc motor', 'Motor 1.6 16V 1600 cc', '36 ay 1500 TL taksit imkanı',
      '24 ay 2026 sonuna kadar garantili', 'Kredi 60 ay 3500 TL', 'Taksitle 18 AY 2000 TL',
      '50 bin 500 TL', '18 ADET 1200', '64 GB 1000'
    ]) expect(maskeleMetin(t), t).toBe(t)
  })
  it('YANLIŞ POZİTİF: motor/donanım rozetleri eşleşmez', () => {
    for (const t of ['35 TDI 90', '16 CDI 80', '34 GLA 250', '20 DSG 12'])
      expect(maskeleMetin(t), t).toBe(t)
  })
  it('YANLIŞ POZİTİF: 81 üstü il kodu yok, uzun sayının içi kırpılmaz', () => {
    expect(maskeleMetin('99 ABC 12')).toBe('99 ABC 12')
    expect(maskeleMetin('2020 CLA 45')).toBe('2020 CLA 45')
  })
})

describe('yapı korunur', () => {
  it('sayı değil, YER TUTUCU bırakır — galeri deseni sinyali ayakta kalır', () => {
    const s = maskeleMetin('Sahibinden satılık. 0532 123 45 67 - 0555 987 65 43, IBAN: TR33 0006 1005 1978 6457 8413 26')
    expect(s).toBe('Sahibinden satılık. [telefon] - [telefon], IBAN: [iban]')
  })
  it('gerçek ilan metni bozulmadan geçer', () => {
    const s = 'Aracımız 2019 model Fiat Egea 1.6 Multijet Lounge paket. Tramer kaydı yoktur, ' +
      'hatasız boyasızdır. 150.000 km de zincir değişimi yapıldı. 16 inç jant, 4x4 değildir.'
    expect(maskeleMetin(s)).toBe(s)
  })
})

describe('maskeleIlan', () => {
  it('başlık, açıklama ve ekAlanlar', () => {
    const ilan = {
      baslik: 'ACİL 0532 123 45 67 SAHİBİNDEN TEMİZ',
      aciklamaText: 'Detay için mail: satici@example.com',
      ekAlanlar: { 'Motor Gücü': '190 hp', 'Not': 'IBAN TR33 0006 1005 1978 6457 8413 26' }
    }
    maskeleIlan(ilan)
    expect(ilan.baslik).toBe('ACİL [telefon] SAHİBİNDEN TEMİZ')
    expect(ilan.aciklamaText).toBe('Detay için mail: [e-posta]')
    expect(ilan.ekAlanlar['Motor Gücü']).toBe('190 hp')
    expect(ilan.ekAlanlar['Not']).toBe('IBAN [iban]')
  })
  it('boş açıklama patlamaz', () => {
    expect(maskeleIlan({ baslik: 'Egea', aciklamaText: null, ekAlanlar: {} }).aciklamaText).toBe(null)
  })
})
