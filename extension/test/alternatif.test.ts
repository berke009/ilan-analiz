import { describe, it, expect } from 'vitest'
import { alternatifSec } from '../src/alternatif'

const satir = (id: string, yil: number, fiyat: number, km: number): any => ({
  ilanId: id, url: null, marka: null, seri: null, model: null, baslik: 'x',
  yil, km, fiyat: { tutar: fiyat, paraBirimi: 'TL' }, il: null
})

const ilan = (fiyat: number | null, km: number | null, yil: number | null): any => ({
  ilanId: '999', fiyat: fiyat == null ? null : { tutar: fiyat, paraBirimi: 'TL' }, km, yil
})

describe('alternatifSec', () => {
  it('daha aza aynısı: daha ucuz + benzer km + en az aynı yaş → seçilir', () => {
    const hedef = ilan(500000, 100000, 2020)
    const aday = satir('a1', 2020, 460000, 105000)
    const sonuc = alternatifSec(hedef, [aday])
    expect(sonuc).toHaveLength(1)
    expect(sonuc[0].satir.ilanId).toBe('a1')
  })

  it('aynı paraya daha iyisi: benzer fiyat + çok daha az km → seçilir', () => {
    const hedef = ilan(500000, 100000, 2020)
    const aday = satir('a2', 2020, 505000, 70000)
    const sonuc = alternatifSec(hedef, [aday])
    expect(sonuc).toHaveLength(1)
    expect(sonuc[0].satir.ilanId).toBe('a2')
  })

  it('aynı paraya daha iyisi: benzer fiyat + en az 1 yaş daha yeni → seçilir', () => {
    const hedef = ilan(500000, 100000, 2020)
    const aday = satir('a3', 2022, 505000, 100000)
    const sonuc = alternatifSec(hedef, [aday])
    expect(sonuc).toHaveLength(1)
  })

  it('daha pahalı + daha kötü aday elenir', () => {
    const hedef = ilan(500000, 100000, 2020)
    const kotu = satir('k1', 2018, 600000, 200000)
    expect(alternatifSec(hedef, [kotu])).toHaveLength(0)
  })

  it('adet sınırı uygulanır', () => {
    const hedef = ilan(500000, 100000, 2020)
    const adaylar = [
      satir('a', 2020, 100000, 100000),
      satir('b', 2020, 200000, 100000),
      satir('c', 2020, 300000, 100000),
      satir('d', 2020, 400000, 100000)
    ]
    expect(alternatifSec(hedef, adaylar, 2)).toHaveLength(2)
  })

  it('en yüksek kazanç puanlı adaylar önce gelir', () => {
    const hedef = ilan(500000, 100000, 2020)
    const dusukKazanc = satir('dusuk', 2020, 490000, 100000)
    const yuksekKazanc = satir('yuksek', 2020, 100000, 100000)
    const sonuc = alternatifSec(hedef, [dusukKazanc, yuksekKazanc], 2)
    expect(sonuc[0].satir.ilanId).toBe('yuksek')
  })

  it('gerekçe metni doğru sayıları içerir', () => {
    const hedef = ilan(500000, 100000, 2020)
    const aday = satir('a1', 2020, 460000, 75000)
    const sonuc = alternatifSec(hedef, [aday])
    expect(sonuc[0].gerekce).toContain('40.000 TL daha ucuz')
    expect(sonuc[0].gerekce).toContain('25.000 km daha az')
  })

  it('aynı fiyata daha yeni yaş gerekçesi doğru biçimlenir', () => {
    const hedef = ilan(500000, 100000, 2020)
    const aday = satir('a3', 2022, 500000, 100000)
    const sonuc = alternatifSec(hedef, [aday])
    expect(sonuc[0].gerekce).toBe('aynı fiyata 2 yaş daha yeni')
  })

  it('hedef km null iken çökmez', () => {
    const hedef = ilan(500000, null, 2020)
    const aday = satir('a1', 2020, 400000, 50000)
    expect(() => alternatifSec(hedef, [aday])).not.toThrow()
    expect(alternatifSec(hedef, [aday])).toHaveLength(1)
  })

  it('hedef fiyat null iken hiçbir aday seçilmez', () => {
    const hedef = ilan(null, 100000, 2020)
    const aday = satir('a1', 2020, 400000, 50000)
    expect(alternatifSec(hedef, [aday])).toHaveLength(0)
  })
})
