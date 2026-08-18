import type { ListRow, ScoreResult } from './schemas'
import { yuzdelik } from './stats'
import { yillikBeklenen } from './km'

// Liste skoru artık DETERMİNİSTİK — AI çağrısı yok.
//
// Canlıda ölçüldü: günde ~51.000 liste skorlaması, tüm Gemini kredisini saatler içinde
// yaktı ve analiz katmanını (ürünün asıl değerini) kredisiz bıraktı. Oysa liste skorunun
// girdileri zaten sayısal: sayfadaki fiyat dağılımı, yıl, km. AI'nın buradaki katkısı
// bir cümle kalıbıydı; maliyeti ise ürünü kapatmaktı.
//
// AI detay analizinde kalıyor — kronik sorunlar, ilan metni yorumu, pazarlık stratejisi
// gerçekten model isteyen işler. Liste rozeti ise "hangisine bakmaya değer" filtresi;
// fiyat konumu + km/yaş bunun için yeterli sinyal.
//
// Maliyet: 0. Gecikme: ~0 ms (önceden AI turu ~2 sn). Kota: gereksiz.

const BUGUN_YILI = () => new Date().getFullYear()

export function listeSkoru(s: ListRow, sayfaFiyatlari: number[], simdikiYil = BUGUN_YILI()): ScoreResult {
  let skor = 6.5
  const etiketler: string[] = []
  const cumleler: string[] = []

  // --- fiyat konumu: sayfadaki dağılıma göre yüzdelik ---
  // En az 5 fiyat yoksa dağılım anlamsız; fiyat bileşeni atlanır.
  if (s.fiyat?.paraBirimi === 'TL' && sayfaFiyatlari.length >= 5) {
    const pct = yuzdelik(sayfaFiyatlari, s.fiyat.tutar)
    skor += (50 - pct) / 25 // 0. yüzdelik +2, 100. yüzdelik -2
    if (pct <= 25) { etiketler.push('Ucuz'); cumleler.push(`fiyat sayfadaki ilanların %${100 - pct}'inden düşük`) }
    else if (pct >= 75) { etiketler.push('Pahalı'); cumleler.push(`fiyat sayfadaki ilanların çoğundan yüksek`) }
    else { etiketler.push('Piyasada'); cumleler.push('fiyat sayfa ortalamasına yakın') }
  }

  // --- km / yaş: beklenen yıllık kullanım km.ts ile aynı tabandan ---
  if (s.km != null && s.yil != null && simdikiYil > s.yil) {
    const yas = simdikiYil - s.yil
    const beklenen = yas * yillikBeklenen(null, null) // ListRow'da kategori/yakıt yok; genel taban
    const oran = s.km / Math.max(beklenen, 1)
    if (oran > 1.6) { skor -= 1.5; etiketler.push('Yüksek KM'); cumleler.push('km yaşına göre çok yüksek') }
    else if (oran > 1.2) { skor -= 0.7; cumleler.push('km yaşına göre yüksekçe') }
    else if (oran < 0.4 && yas >= 5) { skor -= 0.5; etiketler.push('Düşük KM'); cumleler.push('km şüpheli derecede düşük, kaydı sorgulayın') }
    else if (oran < 0.8) { skor += 0.5; cumleler.push('km yaşına göre düşük') }
    else { cumleler.push('km yaşına göre normal') }
  }

  // Şema etiketleri 2 ile sınırlıyor; skoru 0.5-9.5 bandında tut — uçlar
  // (0 ve 10) AI'sız bir kalıptan çıkmayacak kadar iddialı olur.
  skor = Math.min(9.5, Math.max(0.5, Math.round(skor * 10) / 10))

  return {
    ilanId: s.ilanId,
    skor,
    etiketler: etiketler.slice(0, 2),
    tekCumle: cumleler.length
      ? cumleler.join('; ').replace(/^./, c => c.toUpperCase()) + '.'
      : 'Karşılaştırma için yeterli veri yok.'
  }
}
