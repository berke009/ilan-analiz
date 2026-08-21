import type { AnalyzeRequest, BatchScoreRequest } from 'shared'

export type IstekMesaj =
  // siteAd paylaşılan önbellek anahtarının parçası: iki farklı sitede aynı ilan
  // numarası çakışabiliyor ve birinin analizi öbürüne servis edilirdi.
  // zorla: paylaşılan önbellek OKUMASINI atla, analizi kullanıcının kendi anahtarıyla
  // yeniden üret. Panelde "Güncelle" düğmesi bunu tetikliyor. Sonuç yine paylaşıma
  // yazılır ve sunucu, mevcut kayıtla skoru karşılaştırıp itiraz sayar — yani
  // düzeltme, bir tıklamanın değil GERÇEK ikinci bir analizin ürünü oluyor.
  | { tip: 'analyze'; istek: AnalyzeRequest & { siteAd?: string; zorla?: boolean } }
  | { tip: 'batchScore'; istek: BatchScoreRequest }
  | { tip: 'popupAc' }

export type CevapMesaj =
  // kaynak: sonuç kullanıcının kendi anahtarıyla mı üretildi ('kendi') yoksa
  // paylaşılan önbellekten mi geldi ('paylasilan'). Panel bunu GÖSTERMEK ZORUNDA —
  // başka birinin ürettiği bir değerlendirmeyi kendi analizin gibi sunmak,
  // kullanıcının bilmesi gereken şeyi saklamak olur.
  | { ok: true; veri: unknown; kaynak?: 'kendi' | 'paylasilan'; paylasimTs?: number }
  | { ok: false; hata: string }
