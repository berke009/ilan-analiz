import { describe, it, expect } from 'vitest'
import { render } from 'preact'
import { Panel } from '../src/ui/Panel'

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

const sonuc: any = {
  skor: 7.6, durumEtiketi: 'Makul', chipler: ['Dizel', 'Otomatik'],
  bayraklar: [{ tip: 'kirmizi', metin: 'Triger değişmemiş' }, { tip: 'sari', metin: 'Tramer sorulmalı' }],
  avantajlar: ['Fiyat avantajlı'], dezavantajlar: ['Yüksek km'],
  ozet: 'Piyasa altında bakımlı araç.', pazarlikHedefi: 1320000, fiyatYorumu: 'Medyan altı.',
  fiyatIstatistik: { medyan: 1375000, p25: 1300000, p75: 1450000, n: 12, yuzdelik: 35 },
  kmDurum: { beklenenKm: 150000, oran: 0.65, etiket: 'dusuk', yorum: 'Yaşına göre az kullanılmış.' },
  kronikSorunlar: [{ baslik: 'Turbo arızası', aciklama: 'Sık görülür, bakım kaydı istenmeli.', onem: 'yuksek' }]
}

function cizdir(durum: any): HTMLElement {
  const kok = document.createElement('div')
  render(<Panel durum={durum} />, kok)
  return kok
}

describe('Panel', () => {
  it('hazir: skor, etiket, pazarlık, bayraklar, özet', () => {
    const k = cizdir({ asama: 'hazir', sonuc })
    expect(k.textContent).toContain('7.6')
    expect(k.textContent).toContain('Makul')
    expect(k.textContent).toContain('1.320.000')
    expect(k.textContent).toContain('Triger değişmemiş')
    expect(k.textContent).toContain('Piyasa altında')
  })
  it('fiyatIstatistik null → slider ve pazarlık gizli (pazarlikHedefi dolu olsa bile)', () => {
    const k = cizdir({ asama: 'hazir', sonuc: { ...sonuc, fiyatIstatistik: null } })
    expect(k.querySelector('[data-rol="slider"]')).toBe(null)
    expect(k.querySelector('.pazarlik')).toBe(null)
  })
  it('yukleniyor: skeleton', () => {
    expect(cizdir({ asama: 'yukleniyor' }).querySelector('[data-rol="skeleton"]')).not.toBe(null)
  })
  it('hata: mesaj + tekrar butonu', () => {
    let tekrarlandi = false
    const k = cizdir({ asama: 'hata', mesaj: 'limit', tekrar: () => { tekrarlandi = true } })
    ;(k.querySelector('[data-rol="tekrar"]') as HTMLButtonElement).click()
    expect(tekrarlandi).toBe(true)
  })
  it('kmDurum dolu → KİLOMETRE bölümü ve yorum render edilir', () => {
    const k = cizdir({ asama: 'hazir', sonuc })
    const bolum = k.querySelector('[data-rol="km-bolum"]')
    expect(bolum).not.toBe(null)
    expect(bolum!.textContent).toContain('Düşük KM')
    expect(bolum!.textContent).toContain('Yaşına göre az kullanılmış.')
  })
  it('kmDurum null → KİLOMETRE bölümü yok', () => {
    const k = cizdir({ asama: 'hazir', sonuc: { ...sonuc, kmDurum: null } })
    expect(k.querySelector('[data-rol="km-bolum"]')).toBe(null)
  })
  it('kronikSorunlar dolu → başlıklar render edilir', () => {
    const k = cizdir({ asama: 'hazir', sonuc })
    const bolum = k.querySelector('[data-rol="kronik-bolum"]')
    expect(bolum).not.toBe(null)
    expect(bolum!.textContent).toContain('Turbo arızası')
  })
  it('kronikSorunlar boş dizi → bölüm yok', () => {
    const k = cizdir({ asama: 'hazir', sonuc: { ...sonuc, kronikSorunlar: [] } })
    expect(k.querySelector('[data-rol="kronik-bolum"]')).toBe(null)
  })
  it('küçült düğmesine tıklayınca gövde gizlenir', () => {
    const k = cizdir({ asama: 'hazir', sonuc })
    const govde = k.querySelector('[data-rol="govde"]') as HTMLElement
    expect(govde.style.display).not.toBe('none')
    ;(k.querySelector('[data-rol="kucult"]') as HTMLButtonElement).click()
    expect(govde.style.display).toBe('none')
    ;(k.querySelector('[data-rol="kucult"]') as HTMLButtonElement).click()
    expect(govde.style.display).not.toBe('none')
  })
  it('alternatifler dolu → bölüm render edilir, başlık/gerekçe görünür, href mutlak ve rel güvenli', () => {
    const alternatifler = [
      { satir: { ilanId: 'x1', url: '/ilan/x1', marka: 'Toyota', seri: 'Corolla', model: 'Corolla', baslik: 'Toyota Corolla 1.6', yil: 2020, km: 85000, fiyat: { tutar: 1200000, paraBirimi: 'TL' }, il: 'İstanbul' }, gerekce: 'aynı fiyata 100.000 TL daha ucuz' }
    ]
    const k = cizdir({ asama: 'hazir', sonuc, alternatifler })
    const bolum = k.querySelector('[data-rol="alternatif-bolum"]')
    expect(bolum).not.toBe(null)
    expect(bolum!.textContent).toContain('Toyota Corolla 1.6')
    expect(bolum!.textContent).toContain('aynı fiyata 100.000 TL daha ucuz')
    const link = bolum!.querySelector('a') as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('https://www.sahibinden.com/ilan/x1')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.getAttribute('target')).toBe('_blank')
  })
  it('alternatifler boş/undefined → bölüm yok', () => {
    expect(cizdir({ asama: 'hazir', sonuc, alternatifler: [] }).querySelector('[data-rol="alternatif-bolum"]')).toBe(null)
    expect(cizdir({ asama: 'hazir', sonuc }).querySelector('[data-rol="alternatif-bolum"]')).toBe(null)
  })
  it('hiçbir durumda emoji render edilmez', () => {
    const durumlar = [
      { asama: 'yukleniyor' },
      { asama: 'okunamadi' },
      { asama: 'hata', mesaj: 'limit', tekrar: () => {} },
      { asama: 'hazir', sonuc }
    ]
    for (const d of durumlar) expect(cizdir(d).textContent ?? '').not.toMatch(EMOJI_RE)
  })
})

describe('karşılaştırılan ilanlar (katlanır)', () => {
  const satir = (id: string, baslik: string, yil: number, km: number, fiyat: number, url: string | null = null): any => ({
    ilanId: id, url: url ?? `/ilan/vasita-${id}/detay`, marka: 'Fiat', seri: 'Egea',
    model: null, baslik, yil, km, fiyat: { tutar: fiyat, paraBirimi: 'TL' }, il: 'İzmir'
  })

  it('benzerler verilince bölüm render edilir, fiyat sırasına dizilir, linkler mutlak', () => {
    const k = cizdir({
      asama: 'hazir', sonuc,
      benzerler: [satir('3', 'Pahalı Egea', 2019, 90000, 950000), satir('1', 'Ucuz Egea', 2018, 140000, 720000)]
    })
    const bolum = k.querySelector('[data-rol="benzer-bolum"]')
    expect(bolum).not.toBe(null)
    expect(bolum!.textContent).toContain('Karşılaştırılan 2 ilanı gör')
    const linkler = [...k.querySelectorAll('.benzerSatir')] as HTMLAnchorElement[]
    expect(linkler).toHaveLength(2)
    expect(linkler[0].textContent).toContain('Ucuz Egea')   // ucuz önce
    expect(linkler[1].textContent).toContain('Pahalı Egea')
    expect(linkler[0].getAttribute('href')).toBe('https://www.sahibinden.com/ilan/vasita-1/detay')
    expect(linkler[0].getAttribute('rel')).toBe('noopener noreferrer')
    expect(linkler[0].getAttribute('target')).toBe('_blank')
    expect(linkler[0].textContent).toContain('140 bin km')
  })

  it('mutlak url olduğu gibi kalır', () => {
    const k = cizdir({ asama: 'hazir', sonuc, benzerler: [satir('9', 'Dış Link', 2020, 50000, 800000, 'https://www.sahibinden.com/ilan/x-9/detay')] })
    expect((k.querySelector('.benzerSatir') as HTMLAnchorElement).getAttribute('href')).toBe('https://www.sahibinden.com/ilan/x-9/detay')
  })

  it('benzerler yok/boş → bölüm yok', () => {
    expect(cizdir({ asama: 'hazir', sonuc }).querySelector('[data-rol="benzer-bolum"]')).toBe(null)
    expect(cizdir({ asama: 'hazir', sonuc, benzerler: [] }).querySelector('[data-rol="benzer-bolum"]')).toBe(null)
  })
})

describe('alternatif bölümü boş durumu', () => {
  const b = (id: string): any => ({ ilanId: id, url: `/ilan/vasita-${id}/detay`, marka: null, seri: null,
    model: null, baslik: `İlan ${id}`, yil: 2020, km: 100000, fiyat: { tutar: 900000, paraBirimi: 'TL' }, il: null })

  // Alternatif üretimi kapatıldı. Karşılaştırma satırları varken bile "daha iyi bir
  // seçenek çıkmadı" YAZILMAMALI: hiç aramadığımız bir şey hakkında iddia olurdu.
  it('karşılaştırma var ama alternatif yoksa hiçbir iddia yazmaz', () => {
    const k = cizdir({ asama: 'hazir', sonuc, alternatifler: [], benzerler: [b('1'), b('2'), b('3')] })
    expect(k.querySelector('[data-rol="alternatif-bolum"]')).toBe(null)
    expect(k.querySelector('[data-rol="alternatif-yok"]')).toBe(null)
    expect(k.textContent).not.toContain('daha iyi bir seçenek çıkmadı')
  })

  it('alternatif varsa boş durum yazısı görünmez', () => {
    const k = cizdir({ asama: 'hazir', sonuc, benzerler: [b('1'), b('2')],
      alternatifler: [{ satir: b('9'), gerekce: '100.000 TL daha ucuz' }] })
    expect(k.querySelector('[data-rol="alternatif-yok"]')).toBe(null)
    expect(k.querySelectorAll('.altSatir')).toHaveLength(1)
  })

  it('hiç karşılaştırma yapılamadıysa bölüm hiç çıkmaz', () => {
    const k = cizdir({ asama: 'hazir', sonuc, alternatifler: [], benzerler: [] })
    expect(k.querySelector('[data-rol="alternatif-bolum"]')).toBe(null)
  })
})

// Hesap/kota/ödeme akışı KALKTI: uzantı ücretsiz, kullanıcı kendi anahtarını giriyor.
// Panelin kota hatasında yapacağı tek iş kalmadı; yerine anahtar kurulumu geldi.
describe('anahtar kurulum çağrısı', () => {
  it('anahtar yokken kurulum düğmesi çıkar, "tekrar dene" çıkmaz', () => {
    const k = cizdir({ asama: 'hata', mesaj: 'anahtarYok', tekrar: () => {} })
    expect(k.querySelector('[data-rol="anahtar-ac"]')?.textContent).toBe('Anahtarı gir')
    expect(k.querySelector('[data-rol="tekrar"]')).toBe(null)
    expect(k.textContent).toContain('ücretsiz')
    expect(k.textContent).toContain('kendi Google Gemini anahtarınla')
  })

  it('anahtar sorunluysa da kuruluma yönlendirir', () => {
    const k = cizdir({ asama: 'hata', mesaj: 'anahtarSorunu', tekrar: () => {} })
    expect(k.querySelector('[data-rol="anahtar-ac"]')).not.toBe(null)
    expect(k.textContent).toContain('Google AI Studio')
  })

  // Geçici hatalarda kurulum ekranı GÖSTERİLMEMELİ: anahtar zaten doğru, sorun geçici.
  it('geçici hatalarda normal "tekrar dene" akışı korunur', () => {
    for (const kod of ['ag', 'ai', 'hizLimiti']) {
      const k = cizdir({ asama: 'hata', mesaj: kod, tekrar: () => {} })
      expect(k.querySelector('[data-rol="tekrar"]'), kod).not.toBe(null)
      expect(k.querySelector('[data-rol="anahtar-ac"]'), kod).toBe(null)
    }
  })

  it('hız limiti beklemeyi söyler, anahtarı suçlamaz', () => {
    const k = cizdir({ asama: 'hata', mesaj: 'hizLimiti', tekrar: () => {} })
    expect(k.textContent).toContain('hız sınırına takıldı')
  })
})

describe('paylaşılan sonuç beyanı', () => {
  it('paylaşılan önbellekten gelen sonuç AÇIKÇA söylenir', () => {
    // Başkasının değerlendirmesini kendi analizin gibi göstermek, kullanıcının
    // bilmesi gereken tek şeyi saklamak olur.
    const k = cizdir({ asama: 'hazir', sonuc, paylasim: { ts: Date.now() - 3 * 3600_000 } })
    const not = k.querySelector('[data-rol="paylasim-not"]')!
    expect(not).not.toBeNull()
    expect(not.textContent).toContain('paylaşılan önbellekten')
    expect(not.textContent).toContain('3 saat önce')
    // Hangi sayıların yine de kendi verisinden geldiğini de söylemeli
    expect(not.textContent).toContain('kendi verinle')
  })

  it('kendi anahtarıyla üretilen sonuçta not YOKTUR', () => {
    expect(cizdir({ asama: 'hazir', sonuc }).querySelector('[data-rol="paylasim-not"]')).toBeNull()
  })

  it('yaş metni dakika/saat/gün olarak kabalaşır', async () => {
    const { yasMetni } = await import('../src/ui/Panel')
    const simdi = 1_700_000_000_000
    expect(yasMetni(simdi - 5 * 60_000, simdi)).toBe('5 dakika önce')
    expect(yasMetni(simdi - 4 * 3600_000, simdi)).toBe('4 saat önce')
    expect(yasMetni(simdi - 30 * 3600_000, simdi)).toBe('1 gün önce')
  })
})
