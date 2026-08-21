import { describe, it, expect, vi } from 'vitest'
import { bellekDepo, toleransli } from '../src/depo'
import { limitDene, DAKIKA, GUN } from '../src/limit'

const T0 = 1_700_000_000_000 // sabit an: sabit pencere hesabı saate bağlı, gerçek zaman testi kırılgan yapar

describe('sabit pencere sayacı', () => {
  it('sınıra kadar geçirir, sonra keser', async () => {
    const depo = bellekDepo()
    const kural = [{ adet: 3, pencereSn: DAKIKA }]
    for (let i = 0; i < 3; i++) {
      expect((await limitDene(depo, 'yazma', 'a', kural, T0)).ok, `istek ${i}`).toBe(true)
    }
    expect(await limitDene(depo, 'yazma', 'a', kural, T0)).toMatchObject({ ok: false })
  })

  it('pencere değişince sayaç kendiliğinden sıfırlanır', async () => {
    const depo = bellekDepo()
    const kural = [{ adet: 1, pencereSn: DAKIKA }]
    expect((await limitDene(depo, 'yazma', 'a', kural, T0)).ok).toBe(true)
    expect((await limitDene(depo, 'yazma', 'a', kural, T0)).ok).toBe(false)
    // Pencere anahtarın içinde: yeni pencere yeni anahtar demek, elle sıfırlama yok.
    expect((await limitDene(depo, 'yazma', 'a', kural, T0 + 60_000)).ok).toBe(true)
  })

  it('bekleSn pencerenin sonuna kadar olan süreyi verir', async () => {
    const depo = bellekDepo()
    const kural = [{ adet: 1, pencereSn: DAKIKA }]
    const an = Math.floor(T0 / 60_000) * 60_000 + 10_000 // pencerenin 10. saniyesi
    await limitDene(depo, 'yazma', 'a', kural, an)
    const s = await limitDene(depo, 'yazma', 'a', kural, an)
    expect(s).toEqual({ ok: false, bekleSn: 50 })
  })

  it('alanlar ve kimlikler ayrı sayılır', async () => {
    const depo = bellekDepo()
    const kural = [{ adet: 1, pencereSn: DAKIKA }]
    await limitDene(depo, 'yazma', 'a', kural, T0)
    expect((await limitDene(depo, 'okuma', 'a', kural, T0)).ok).toBe(true)
    expect((await limitDene(depo, 'yazma', 'b', kural, T0)).ok).toBe(true)
    expect((await limitDene(depo, 'yazma', 'a', kural, T0)).ok).toBe(false)
  })

  it('dakikalık limit dolsa bile GÜNLÜK sayaç işlemeye devam eder', async () => {
    // Erken çıkış hatası: dakikalık limitin ucunda gezinen biri günlük tavanı hiç
    // görmeden sınırsız istek atabilirdi.
    const depo = bellekDepo()
    const kurallar = [{ adet: 1, pencereSn: DAKIKA }, { adet: 2, pencereSn: GUN }]
    await limitDene(depo, 'yazma', 'a', kurallar, T0)          // günlük 1
    await limitDene(depo, 'yazma', 'a', kurallar, T0)          // dakikalık dolu, günlük 2
    // Yeni dakika: dakikalık serbest ama günlük tavan çoktan dolmuş olmalı
    const s = await limitDene(depo, 'yazma', 'a', kurallar, T0 + 60_000)
    expect(s.ok).toBe(false)
  })
})

describe('bellek deposu', () => {
  it('ilk yazan kazanır', async () => {
    const depo = bellekDepo()
    expect(await depo.yazYoksa('k', 'ilk', 60)).toBe(true)
    expect(await depo.yazYoksa('k', 'ikinci', 60)).toBe(false)
    expect(await depo.oku('k')).toBe('ilk')
  })

  it('TTL dolunca kayıt düşer ve yeri boşalır', async () => {
    vi.useFakeTimers()
    try {
      const depo = bellekDepo()
      await depo.yazYoksa('k', 'ilk', 60)
      vi.advanceTimersByTime(61_000)
      expect(await depo.oku('k')).toBeNull()
      // Süresi dolan anahtar yeniden yazılabilmeli: aksi hâlde bir kez zehirlenen
      // anahtar TTL'den sonra da kilitli kalırdı.
      expect(await depo.yazYoksa('k', 'yeni', 60)).toBe(true)
    } finally { vi.useRealTimers() }
  })
})

describe('toleranslı sarmalayıcı', () => {
  it('depo patladığında hata fırlatmaz, güvenli varsayılana düşer', async () => {
    const bozuk = {
      oku: async () => { throw new Error('yok') },
      yazYoksa: async () => { throw new Error('yok') },
      sayacArtir: async () => { throw new Error('yok') },
      saglikli: async () => { throw new Error('yok') },
      kapat: async () => {}
    }
    const d = toleransli(bozuk)
    expect(await d.oku('k')).toBeNull()
    expect(await d.yazYoksa('k', 'v', 60)).toBe(false)
    // 0 = "limit dolmadı": depo çökünce limitler açılır. Uçlar zaten depo yokken
    // önbelleksiz çalışıyor, yani kötüye kullanımdan elde edilecek şey de kalmıyor.
    expect(await d.sayacArtir('k', 60)).toBe(0)
    expect(await d.saglikli()).toBe(false)
  })
})
