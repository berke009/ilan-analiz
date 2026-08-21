import { describe, it, expect } from 'vitest'
import { yillikBeklenen, kmDurumu } from '../src/km'

describe('yillikBeklenen', () => {
  it('kategori dalları', () => {
    expect(yillikBeklenen('Motosiklet', null)).toBe(6000)
    expect(yillikBeklenen('Ticari Araçlar', null)).toBe(30000)
    expect(yillikBeklenen('Kamyon', null)).toBe(30000)
    expect(yillikBeklenen('Minibüs', null)).toBe(30000)
    expect(yillikBeklenen('Midibüs', null)).toBe(30000)
    expect(yillikBeklenen('Minivan', null)).toBe(25000)
    expect(yillikBeklenen('Panelvan', null)).toBe(25000)
  })
  it('yakıt dalları', () => {
    expect(yillikBeklenen(null, 'LPG')).toBe(25000)
    expect(yillikBeklenen(null, 'Dizel')).toBe(20000)
    expect(yillikBeklenen(null, 'Elektrik')).toBe(15000)
    expect(yillikBeklenen(null, 'Hibrit')).toBe(15000)
    expect(yillikBeklenen(null, 'Benzin')).toBe(13000)
  })
  it('hiçbiri tutmazsa genel ortalama', () => {
    expect(yillikBeklenen(null, null)).toBe(15000)
    expect(yillikBeklenen('Otomobil', 'Yakıt Yok')).toBe(15000)
  })
  it('kategori yakıttan önce kontrol edilir', () => {
    // ticari + dizel → kategori kazanır (30000, 20000 değil)
    expect(yillikBeklenen('Ticari Araçlar', 'Dizel')).toBe(30000)
  })
})

describe('kmDurumu', () => {
  it('dizel 2019 model, 112000 km, 2026 → yas 7, beklenen 140000, oran 0.8 → sınırda normal (0.8 < 0.8 yanlış)', () => {
    const d = kmDurumu(112000, 2019, 'Otomobil', 'Dizel', 2026)
    expect(d).not.toBeNull()
    expect(d!.beklenenKm).toBe(140000)
    expect(d!.oran).toBeCloseTo(0.8)
    expect(d!.etiket).toBe('normal')
  })
  it('çok düşük km → cok-dusuk + ekspertiz uyarısı', () => {
    // dizel, yas 7, beklenen 140000, oran 0.5 için km=70000
    const d = kmDurumu(70000, 2019, 'Otomobil', 'Dizel', 2026)
    expect(d!.etiket).toBe('cok-dusuk')
    expect(d!.yorum).toContain('ekspertiz')
  })
  it('çok yüksek km → cok-yuksek + bakım geçmişi uyarısı', () => {
    // oran 1.8 için km=252000
    const d = kmDurumu(252000, 2019, 'Otomobil', 'Dizel', 2026)
    expect(d!.etiket).toBe('cok-yuksek')
    expect(d!.yorum).toContain('bakım geçmişi')
  })
  it('yaş 0 koruması: aynı yıl model → yas en az 1', () => {
    const d = kmDurumu(10000, 2026, 'Otomobil', 'Benzin', 2026)
    expect(d!.beklenenKm).toBe(13000) // yas=1 * 13000
  })
  it('km null → null', () => {
    expect(kmDurumu(null, 2019, 'Otomobil', 'Dizel', 2026)).toBeNull()
  })
  it('yil null → null', () => {
    expect(kmDurumu(100000, null, 'Otomobil', 'Dizel', 2026)).toBeNull()
  })
})

describe('6.000 km eşiği', () => {
  // İkinci el araç ticaretindeki 6 ay / 6.000 km sınırı yüzünden araçlar eşiğin
  // hemen üstünde ilana giriyor. 6.001 km bir kullanım verisi değil, aracın
  // satılabilir hâle geldiği nokta — yaşa oranlamak burada anlamsız.
  it('genç araçta eşiğin hemen üstü ŞÜPHELİ SAYILMAZ', () => {
    const d = kmDurumu(6001, 2025, 'Otomobil', 'Benzin', 2026)!
    expect(d.etiket).toBe('sifir-ayarinda')
    expect(d.yorum).not.toContain('km düşürülmüş')
    expect(d.yorum).toContain('6.000')
  })

  it('eşik bandının tamamı: 6.000–7.000', () => {
    for (const km of [6000, 6100, 6500, 7000]) {
      expect(kmDurumu(km, 2025, 'Otomobil', 'Benzin', 2026)!.etiket, `${km} km`).toBe('sifir-ayarinda')
    }
  })

  it('eşiğin ALTI eşik değildir — satılamayacak araç zaten ilanda olmamalı', () => {
    expect(kmDurumu(5999, 2025, 'Otomobil', 'Benzin', 2026)!.etiket).toBe('cok-dusuk')
  })

  it('eşiğin ÜSTÜ normal akışa döner', () => {
    expect(kmDurumu(7001, 2025, 'Otomobil', 'Benzin', 2026)!.etiket).toBe('cok-dusuk')
  })

  it('ESKİ araçta 6.001 km GERÇEKTEN şüphelidir — eşik kuralı uygulanmaz', () => {
    // 10 yaşındaki bir aracın 6.001 km'si satış eşiğiyle ilgili değil; km düşürme
    // şüphesi burada yerinde ve kırmızı bayrak çıkmaya devam etmeli.
    expect(kmDurumu(6001, 2016, 'Otomobil', 'Benzin', 2026)!.etiket).toBe('cok-dusuk')
  })

  it('eşik yaş sınırı 2 yıl', () => {
    expect(kmDurumu(6001, 2024, 'Otomobil', 'Benzin', 2026)!.etiket).toBe('sifir-ayarinda')
    expect(kmDurumu(6001, 2023, 'Otomobil', 'Benzin', 2026)!.etiket).toBe('cok-dusuk')
  })
})
