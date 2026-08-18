import { describe, it, expect } from 'vitest'
import { ListingDetailSchema, AnalysisResultSchema, BatchScoreRequestSchema } from '../src/index'

const gecerliIlan = {
  ilanId: '90000050', url: 'https://www.sahibinden.com/ilan/x-90000050/detay',
  baslik: '2022 FORD MUSTANG MACH-E', fiyat: { tutar: 2985000, paraBirimi: 'TL' },
  kategori: 'Arazi, SUV & Pickup', marka: 'Ford', seri: 'Mustang Mach-E', model: 'Extended Range',
  yil: 2021, km: 25000, yakit: 'Elektrikli', vites: 'Otomatik', agirHasarKayitli: 'Hayır',
  kimden: 'Galeriden', il: 'İzmir', ilce: 'Konak', aciklamaText: 'Temiz araç',
  modelAramaPath: '/ford-mustang-mach-e', ekAlanlar: { 'Çekiş': '4x4' }
}

describe('şemalar', () => {
  it('geçerli ilanı kabul eder', () => {
    expect(ListingDetailSchema.parse(gecerliIlan).ilanId).toBe('90000050')
  })
  it('null alanlara izin verir ama ilanId zorunlu', () => {
    expect(ListingDetailSchema.safeParse({ ...gecerliIlan, km: null }).success).toBe(true)
    expect(ListingDetailSchema.safeParse({ ...gecerliIlan, ilanId: undefined }).success).toBe(false)
  })
  it('skoru 0-10 dışında reddeder', () => {
    const r = AnalysisResultSchema.safeParse({
      skor: 11, durumEtiketi: 'Makul', chipler: [], bayraklar: [], avantajlar: [],
      dezavantajlar: [], ozet: 'x', pazarlikHedefi: null, fiyatYorumu: 'y', fiyatIstatistik: null
    })
    expect(r.success).toBe(false)
  })
  it('batch istekte 20 satır sınırı', () => {
    const satir = { ilanId: '1', url: null, marka: null, seri: null, model: null, baslik: 'a', yil: 2020, km: 1, fiyat: { tutar: 1, paraBirimi: 'TL' }, il: null }
    expect(BatchScoreRequestSchema.safeParse({ satirlar: Array(21).fill(satir), sayfaFiyatlari: [] }).success).toBe(false)
  })

  const temelSonuc = {
    skor: 7, durumEtiketi: 'Makul', chipler: [], bayraklar: [], avantajlar: [],
    dezavantajlar: [], ozet: 'x', pazarlikHedefi: null, fiyatYorumu: 'y', fiyatIstatistik: null
  }

  it('geçerli kmDurum ve kronikSorunlar içeren sonucu kabul eder', () => {
    const r = AnalysisResultSchema.safeParse({
      ...temelSonuc,
      kmDurum: { beklenenKm: 15000, oran: 0.65, etiket: 'dusuk', yorum: 'Yaşına göre %35 az kullanılmış' },
      kronikSorunlar: [{ baslik: 'Turbo arızası', aciklama: 'Sık görülür', onem: 'yuksek' }]
    })
    expect(r.success).toBe(true)
  })

  it('kmDurum null ve kronikSorunlar boş dizi kabul edilir', () => {
    const r = AnalysisResultSchema.safeParse({ ...temelSonuc, kmDurum: null, kronikSorunlar: [] })
    expect(r.success).toBe(true)
  })

  it('geçersiz kmDurum etiketini reddeder', () => {
    const r = AnalysisResultSchema.safeParse({
      ...temelSonuc,
      kmDurum: { beklenenKm: 15000, oran: 0.65, etiket: 'sacma', yorum: 'x' },
      kronikSorunlar: []
    })
    expect(r.success).toBe(false)
  })
})
