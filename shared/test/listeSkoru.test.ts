import { describe, it, expect } from 'vitest'
import { listeSkoru } from '../src/listeSkoru'
import { ScoreResultSchema } from '../src/schemas'

const YIL = 2026
const satir = (ek: any = {}): any => ({
  ilanId: '1', url: null, marka: 'Fiat', seri: 'Egea', model: null, baslik: 'Test',
  yil: 2019, km: 100000, fiyat: { tutar: 900000, paraBirimi: 'TL' }, il: null, ...ek
})
const fiyatlar = [700000, 800000, 900000, 1000000, 1100000, 1200000, 1300000]

describe('deterministik liste skoru', () => {
  it('şemaya birebir uyar — uzantı değişmeden çalışır', () => {
    expect(() => ScoreResultSchema.parse(listeSkoru(satir(), fiyatlar, YIL))).not.toThrow()
  })

  it('ucuz ilan pahalıdan yüksek skor alır', () => {
    const ucuz = listeSkoru(satir({ fiyat: { tutar: 700000, paraBirimi: 'TL' } }), fiyatlar, YIL)
    const pahali = listeSkoru(satir({ fiyat: { tutar: 1300000, paraBirimi: 'TL' } }), fiyatlar, YIL)
    expect(ucuz.skor).toBeGreaterThan(pahali.skor)
    expect(ucuz.etiketler).toContain('Ucuz')
    expect(pahali.etiketler).toContain('Pahalı')
  })

  it('yaşına göre çok yüksek km skoru düşürür ve etiketlenir', () => {
    const normal = listeSkoru(satir({ km: 100000 }), fiyatlar, YIL)   // 7 yaş, beklenen 105k
    const yuksek = listeSkoru(satir({ km: 260000 }), fiyatlar, YIL)   // oran ~2.5
    expect(yuksek.skor).toBeLessThan(normal.skor)
    expect(yuksek.etiketler).toContain('Yüksek KM')
  })

  it('yaşlı araçta şüpheli düşük km işaretlenir', () => {
    const s = listeSkoru(satir({ yil: 2016, km: 30000 }), fiyatlar, YIL) // 10 yaş, 30k
    expect(s.etiketler).toContain('Düşük KM')
    expect(s.tekCumle).toContain('sorgula')
  })

  it('5 fiyattan az sayfada fiyat bileşeni atlanır, çökmez', () => {
    const s = listeSkoru(satir(), [900000, 950000], YIL)
    expect(s.etiketler).not.toContain('Ucuz')
    expect(ScoreResultSchema.parse(s)).toBeTruthy()
  })

  it('yıl/km/fiyat eksikken bile geçerli sonuç döner', () => {
    const s = listeSkoru(satir({ yil: null, km: null, fiyat: null }), [], YIL)
    expect(ScoreResultSchema.parse(s)).toBeTruthy()
    expect(s.tekCumle).toContain('yeterli veri yok')
  })

  it('skor 0.5–9.5 bandında kalır', () => {
    for (const f of [1, 700000, 5000000]) {
      for (const km of [1000, 100000, 900000]) {
        const s = listeSkoru(satir({ fiyat: { tutar: f, paraBirimi: 'TL' }, km }), fiyatlar, YIL)
        expect(s.skor).toBeGreaterThanOrEqual(0.5)
        expect(s.skor).toBeLessThanOrEqual(9.5)
      }
    }
  })

  it('etiket sayısı şema sınırını (2) aşmaz', () => {
    const s = listeSkoru(satir({ fiyat: { tutar: 700000, paraBirimi: 'TL' }, yil: 2016, km: 30000 }), fiyatlar, YIL)
    expect(s.etiketler.length).toBeLessThanOrEqual(2)
  })
})
