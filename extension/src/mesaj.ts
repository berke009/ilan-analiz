import type { AnalyzeRequest, BatchScoreRequest } from 'shared'

export type IstekMesaj =
  // siteAd paylaşılan önbellek anahtarının parçası: iki farklı sitede aynı ilan
  // numarası çakışabiliyor ve birinin analizi öbürüne servis edilirdi.
  | { tip: 'analyze'; istek: AnalyzeRequest & { siteAd?: string } }
  | { tip: 'batchScore'; istek: BatchScoreRequest }
  | { tip: 'popupAc' }

export type CevapMesaj =
  // kaynak: sonuç kullanıcının kendi anahtarıyla mı üretildi ('kendi') yoksa
  // paylaşılan önbellekten mi geldi ('paylasilan'). Panel bunu GÖSTERMEK ZORUNDA —
  // başka birinin ürettiği bir değerlendirmeyi kendi analizin gibi sunmak,
  // kullanıcının bilmesi gereken şeyi saklamak olur.
  | { ok: true; veri: unknown; kaynak?: 'kendi' | 'paylasilan'; paylasimTs?: number }
  | { ok: false; hata: string }
