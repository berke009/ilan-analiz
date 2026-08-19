import {
  AnalysisResultSchema, analyzeListing, maskeleIlan, fiyatIstatistik, pazarlikTabani,
  clampPazarlik, kmDurumu, type AiClient, type AnalysisResult, type AnalyzeRequest
} from 'shared'

// Sağlayıcı yalnız metni üretir. PII maskesi ve deterministik katmanlar burada tek
// yerde kalır; Gemini ile yerel modelin aynı girdiyi ve aynı güvenlik sınırlarını
// kullanması böyle garanti edilir.
export async function analizCalistir(
  ai: AiClient, model: string, istek: AnalyzeRequest
): Promise<AnalysisResult | null> {
  const { ilan, benzerFiyatlar } = istek
  maskeleIlan(ilan)

  const ist = ilan.fiyat ? fiyatIstatistik(benzerFiyatlar, ilan.fiyat.tutar) : null
  const taban = ist && ilan.fiyat ? pazarlikTabani(ilan.fiyat.tutar, ist.medyan) : null
  const km = kmDurumu(ilan.km, ilan.yil, ilan.kategori, ilan.yakit, new Date().getFullYear())
  const analiz = await analyzeListing(ai, model, ilan, ist, taban, null, km)
  if (!analiz) return null

  // Etiket skorun kullanıcıya dönük adıdır; modelin aynı sayıya farklı ad vermesi
  // paneli çelişkili yapar. Tek ölçeği burada uygula, sağlayıcıdan tahmin etmesini isteme.
  const durumEtiketi = analiz.skor >= 7.5 ? 'İyi Fırsat'
    : analiz.skor >= 5.5 ? 'Makul'
      : analiz.skor >= 3.5 ? 'Dikkatli Ol'
        : 'Riskli'

  return AnalysisResultSchema.parse({
    ...analiz,
    durumEtiketi,
    fiyatYorumu: ist
      ? analiz.fiyatYorumu
      : 'Karşılaştırma için yeterli benzer ilan verisi yok. Fiyat; kilometre, yaş, hasar geçmişi ve donanıma göre ayrıca değerlendirilmelidir.',
    pazarlikHedefi: taban != null && analiz.pazarlikHedefi != null
      ? Math.round(clampPazarlik(analiz.pazarlikHedefi, taban))
      : analiz.pazarlikHedefi,
    fiyatIstatistik: ist,
    kmDurum: km,
    // Kronik sorunlar eski sunucu katmanına aitti. Yerel model internette arama
    // yapmadığı için doğrulanmamış model bilgisi üretmesine izin vermiyoruz.
    kronikSorunlar: []
  })
}
