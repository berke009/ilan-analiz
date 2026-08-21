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

// 6.000 KM EŞİĞİ. İkinci el araç ticareti düzenlemesindeki 6 ay / 6.000 km sınırı
// yüzünden araçlar bu eşiğin HEMEN ÜSTÜNDE ilana giriyor: 6.001, 6.100, 6.500.
// Bu bir kullanım verisi değil, aracın satılabilir hâle geldiği noktadır.
//
// Yaşa oranlamak burada yalnızca yanlış değil, ZARARLI: genç bir araçtaki 6.001 km
// 'cok-dusuk' bandına düşüyor ve prompt onu "km düşürülmüş olabilir, ekspertiz şart"
// kırmızı bayrağına çeviriyordu. Piyasadaki en yaygın normal durumu dolandırıcılık
// gibi göstermek, panelin uyarılarına duyulan güveni topluca aşındırır — kullanıcı
// gerçek bir km düşürme uyarısını da ciddiye almaz.
const ESIK_KM = 6000
const ESIK_UST = 7000
// YALNIZ GENÇ ARAÇTA. 10 yaşındaki bir aracın 6.001 km'si eşikle ilgili değildir;
// gerçekten şüphelidir ve normal akışta 'cok-dusuk' kalmalı.
const ESIK_AZAMI_YAS = 2

export function kmDurumu(
  km: number | null, yil: number | null, kategori: string | null, yakit: string | null, buYil: number
): KmDurum | null {
  if (km == null || yil == null) return null
  const yas = Math.max(1, buYil - yil) // 0'a bölme ve sıfırıncı yıl koruması
  const beklenenKm = yas * yillikBeklenen(kategori, yakit)
  const oran = km / beklenenKm
  const sapma = Math.abs(Math.round((oran - 1) * 100))

  // Eşik kontrolü oran bantlarından ÖNCE: aksi hâlde 'cok-dusuk' dalına düşer.
  if (km >= ESIK_KM && km <= ESIK_UST && buYil - yil <= ESIK_AZAMI_YAS) {
    return {
      beklenenKm, oran, etiket: 'sifir-ayarinda',
      yorum: 'İkinci el satış eşiği olan 6.000 km’nin hemen üstünde — bu bir kullanım verisi değil, satılabilir hâle gelmiş neredeyse sıfır bir araç. Sorulacak şey km değil: neden bu kadar erken satılıyor, garanti ve ilk sahiplik devrediyor mu, sıfır fiyatına göre fark gerçekten kazanç mı.'
    }
  }

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
