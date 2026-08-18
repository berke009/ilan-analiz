import type { ListingDetail, ListRow } from 'shared'

// Uzantı tek bir siteye bağlı kalmasın diye siteye özel olan HER ŞEY bu arayüzün
// arkasında. Ölçüldü: siteye özel kod ~130 satır (sayfa tespiti + iki ayrıştırıcı);
// panel, skorlama, karşılaştırma, alternatifler zaten nötr ListingDetail/ListRow
// tipleri üzerinden çalışıyor ve hiç değişmiyor.
//
// Yeni site eklemek = bu arayüzü uygulayan bir dosya + fixture testi.
export type SiteAdaptoru = {
  /** kayit.json'daki kimlik; log ve testlerde kullanılır */
  ad: string
  /** Göreli ilan bağlantılarını mutlaklaştırmak için sitenin kökü */
  kok: string
  /** Liste sayfasında rozet basılacak satır/kart elemanları */
  satirSecici: string
  /**
   * satirSecici ile bulunan bir elemandan ilan kimliği. listeSatirlari'nın verdiği
   * ilanId ile AYNI değeri döndürmeli — rozetler bu ikisinin eşleşmesiyle basılıyor.
   * Sözleşme burada olmazsa tüketici tek bir sitenin niteliğini varsayar ve diğer
   * sitede rozet sessizce hiç çıkmaz (bir kez oldu: sahibinden data-id, arabam data-imp-id).
   */
  satirId(el: Element): string | null
  sayfaTipi(doc: Document): 'detay' | 'liste' | null
  detayOku(doc: Document, url: string): ListingDetail | null
  listeSatirlari(doc: Document): ListRow[]
}

export type SiteKaydi = { ad: string; kok: string; eslesenler: string[] }
