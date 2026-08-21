import { describe, it, expect } from 'vitest'
import {
  onbellekAnahtari, istatistikDilimi, paylasimaHazirla, birlestir,
  PaylasilanAnalizSchema, PaylasimYazSchema, PAYLASIM_SURUM
} from '../src/onbellek'
import type { AnalysisResult, FiyatIstatistik } from '../src/schemas'

const GIRDI = { site: 'sahibinden', ilanId: '123', fiyat: 800000, model: 'gemini-flash-lite-latest', istDilim: 'd5' }

const IST: FiyatIstatistik = { medyan: 850000, p25: 800000, p75: 900000, n: 12, yuzdelik: 42 }

const SONUC: AnalysisResult = {
  skor: 7.4, durumEtiketi: 'Makul', chipler: ['Dizel'], bayraklar: [{ tip: 'sari', metin: 'Tramer yok' }],
  avantajlar: ['temiz'], dezavantajlar: ['kısa açıklama'], ozet: 'özet cümlesi',
  pazarlikHedefi: 790000, fiyatYorumu: 'medyana yakın',
  fiyatIstatistik: IST,
  kmDurum: { beklenenKm: 120000, oran: 0.83, etiket: 'normal', yorum: 'yaşına uygun' },
  kronikSorunlar: [{ baslik: 'x', aciklama: 'y', onem: 'orta' }]
}

describe('önbellek anahtarı', () => {
  it('aynı girdi hep aynı anahtarı verir', async () => {
    expect(await onbellekAnahtari(GIRDI)).toBe(await onbellekAnahtari({ ...GIRDI }))
  })

  it('64 karakterlik hex — sunucunun beklediği biçim', async () => {
    expect(await onbellekAnahtari(GIRDI)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('HER alan anahtarı değiştirir', async () => {
    const temel = await onbellekAnahtari(GIRDI)
    const varyantlar = [
      { ...GIRDI, site: 'arabam' },      // iki sitede aynı ilan numarası çakışabilir
      { ...GIRDI, ilanId: '124' },
      { ...GIRDI, fiyat: 810000 },       // fiyat düşünce eski analiz geçersiz
      { ...GIRDI, model: 'gemini-3-pro' }, // model değişince metin de değişir
      { ...GIRDI, istDilim: 'yok' }
    ]
    for (const v of varyantlar) expect(await onbellekAnahtari(v), JSON.stringify(v)).not.toBe(temel)
  })

  it('kuruş farkı anahtarı bölmez — fiyat tam sayıya yuvarlanır', async () => {
    expect(await onbellekAnahtari({ ...GIRDI, fiyat: 800000.4 })).toBe(await onbellekAnahtari(GIRDI))
  })

  it('anahtar İLAN METNİ İÇERMEZ: yalnız kimlik, fiyat, sürüm damgası', async () => {
    // Sunucu bu özetten hangi ilana ait olduğunu çözemez; başlık, açıklama ve adres
    // hiç girmiyor. Şema/prompt değişince PAYLASIM_SURUM artırılıp eski kayıtlar düşer.
    expect(PAYLASIM_SURUM).toBeGreaterThan(0)
    const anahtar = await onbellekAnahtari(GIRDI)
    expect(anahtar).not.toContain('123')
    expect(anahtar).not.toContain('sahibinden')
  })
})

describe('istatistik dilimi', () => {
  it('örneklem yoksa "yok"', () => {
    expect(istatistikDilimi(null)).toBe('yok')
  })

  it('yakın yüzdelikler AYNI dilime düşer — önbellek 100 parçaya bölünmesin', () => {
    expect(istatistikDilimi({ ...IST, yuzdelik: 42 })).toBe(istatistikDilimi({ ...IST, yuzdelik: 44 }))
  })

  it('uzak yüzdelikler AYRI dilime düşer — fiyat yorumu ikisi için doğru olamaz', () => {
    expect(istatistikDilimi({ ...IST, yuzdelik: 10 })).not.toBe(istatistikDilimi({ ...IST, yuzdelik: 90 }))
  })

  it('örneklemi olan ile olmayan asla aynı kaydı görmez', () => {
    // Aksi hâlde "medyanın altında" diyen bir metin, üstündeki fiyat kutusu boş olan
    // kullanıcıya gösterilirdi.
    expect(istatistikDilimi(IST)).not.toBe(istatistikDilimi(null))
  })
})

describe('paylaşıma hazırlama', () => {
  it('YALNIZ metin alanları paylaşılır', () => {
    const p = paylasimaHazirla(SONUC)
    expect(Object.keys(p).sort()).toEqual(
      ['avantajlar', 'bayraklar', 'chipler', 'dezavantajlar', 'durumEtiketi', 'fiyatYorumu', 'ozet', 'skor'])
  })

  it('SAYILAR paylaşılmaz: fiyat istatistiği, km durumu, pazarlık hedefi', () => {
    // Bu testin düşmesi, kötü niyetli bir kaydın kullanıcının gördüğü medyana,
    // yüzdeliğe ya da pazarlık rakamına ulaşabilmesi demek.
    const p = paylasimaHazirla(SONUC) as Record<string, unknown>
    expect(p.fiyatIstatistik).toBeUndefined()
    expect(p.kmDurum).toBeUndefined()
    expect(p.pazarlikHedefi).toBeUndefined()
    expect(p.kronikSorunlar).toBeUndefined()
  })

  it('ürettiği kayıt sunucunun şemasından geçer', () => {
    expect(PaylasimYazSchema.safeParse({ anahtar: 'a'.repeat(64), analiz: paylasimaHazirla(SONUC) }).success).toBe(true)
  })
})

describe('birleştirme', () => {
  it('sayılar YEREL hesaptan gelir, paylaşılan metinden değil', () => {
    const yerelIst: FiyatIstatistik = { medyan: 111, p25: 1, p75: 2, n: 5, yuzdelik: 3 }
    const r = birlestir(paylasimaHazirla(SONUC), {
      fiyatIstatistik: yerelIst, kmDurum: null, pazarlikHedefi: 999
    })
    expect(r.fiyatIstatistik).toEqual(yerelIst)
    expect(r.kmDurum).toBeNull()
    expect(r.pazarlikHedefi).toBe(999)
    expect(r.ozet).toBe(SONUC.ozet) // metin paylaşılandan
  })

  it('kronik sorunlar paylaşımla geri gelmez', () => {
    expect(birlestir(paylasimaHazirla(SONUC), {
      fiyatIstatistik: null, kmDurum: null, pazarlikHedefi: null
    }).kronikSorunlar).toEqual([])
  })
})

describe('şema sınırları', () => {
  it('uzun metin reddedilir — şişkin kayıt hem paneli hem depoyu bozar', () => {
    const p = paylasimaHazirla(SONUC)
    expect(PaylasilanAnalizSchema.safeParse({ ...p, ozet: 'a'.repeat(1201) }).success).toBe(false)
    expect(PaylasilanAnalizSchema.safeParse({ ...p, chipler: Array(9).fill('x') }).success).toBe(false)
  })

  it('skor bandı dışına çıkamaz', () => {
    const p = paylasimaHazirla(SONUC)
    expect(PaylasilanAnalizSchema.safeParse({ ...p, skor: 11 }).success).toBe(false)
    expect(PaylasilanAnalizSchema.safeParse({ ...p, skor: -1 }).success).toBe(false)
  })
})
