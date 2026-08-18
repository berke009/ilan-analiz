import type { KmDurum } from './schemas'

// Kategoriye + yakıt tipine göre beklenen YILLIK km (Türkiye ortalamaları)
// ponytail: kaba tablo; gerçek veriyle kalibre edilirse iyileşir
export function yillikBeklenen(kategori: string | null, yakit: string | null): number {
  const k = (kategori ?? '').toLowerCase()
  const y = (yakit ?? '').toLowerCase()
  if (k.includes('motosiklet')) return 6000
  if (k.includes('ticari') || k.includes('kamyon') || k.includes('minibüs') || k.includes('midibüs')) return 30000
  if (k.includes('minivan') || k.includes('panelvan')) return 25000
  if (y.includes('lpg')) return 25000
  if (y.includes('dizel')) return 20000
  if (y.includes('elektrik') || y.includes('hibrit')) return 15000
  if (y.includes('benzin')) return 13000
  return 15000
}

export function kmDurumu(
  km: number | null, yil: number | null, kategori: string | null, yakit: string | null, buYil: number
): KmDurum | null {
  if (km == null || yil == null) return null
  const yas = Math.max(1, buYil - yil) // 0'a bölme ve sıfırıncı yıl koruması
  const beklenenKm = yas * yillikBeklenen(kategori, yakit)
  const oran = km / beklenenKm
  const sapma = Math.abs(Math.round((oran - 1) * 100))

  if (oran < 0.55) {
    return { beklenenKm, oran, etiket: 'cok-dusuk', yorum: `Yaşına göre %${sapma} az kullanılmış — km düşürülmüş olabilir, ekspertiz şart.` }
  }
  if (oran < 0.8) {
    return { beklenenKm, oran, etiket: 'dusuk', yorum: `Yaşına göre %${sapma} az kullanılmış.` }
  }
  if (oran <= 1.2) {
    const yillikBin = Math.round(km / yas / 1000)
    return { beklenenKm, oran, etiket: 'normal', yorum: `Yaşına göre normal kullanım (yılda ~${yillikBin} bin km).` }
  }
  if (oran <= 1.6) {
    return { beklenenKm, oran, etiket: 'yuksek', yorum: `Yaşına göre %${sapma} fazla kullanılmış.` }
  }
  return { beklenenKm, oran, etiket: 'cok-yuksek', yorum: `Yaşına göre %${sapma} fazla kullanılmış — bakım geçmişi kritik.` }
}
