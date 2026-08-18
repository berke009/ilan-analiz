import {
  AnalysisResultSchema, geminiClient, analyzeListing, maskeleIlan,
  fiyatIstatistik, pazarlikTabani, clampPazarlik, kmDurumu, listeSkoru,
  AiKrediHatasi, AiHizLimitiHatasi
} from 'shared'
import type { IstekMesaj, CevapMesaj } from './mesaj'
import { anahtarGetir, VARSAYILAN_MODEL } from './anahtar'
import { tarayici } from './tarayici'

// ANALİZ ARTIK TAMAMEN TARAYICIDA. Sunucumuz analiz akışında yok:
//   · kullanıcının API anahtarı buradan çıkmıyor, Google'a doğrudan gidiyor
//   · ilan içeriği bizim hiçbir sistemimize uğramıyor
//   · kota, hesap, ödeme yok — uzantı ücretsiz
// Anahtar YALNIZ service worker'da okunuyor; content script'e hiç geçmiyor, yani
// ilan sayfasındaki kod ele geçse bile anahtara ulaşamaz.

export async function handleMesaj(
  msg: IstekMesaj, fetcher: typeof fetch = fetch
): Promise<CevapMesaj> {
  if (msg.tip === 'popupAc') {
    // Chrome 127+ ; desteklenmediğinde sessizce geç, panel zaten ipucu metni gösteriyor
    await (tarayici.action as any)?.openPopup?.().catch?.(() => {})
    return { ok: true, veri: null }
  }

  // Liste skorları DETERMİNİSTİK: AI yok, ağ yok, anahtar bile gerekmiyor.
  // Rozetler anahtar girilmeden de çalışsın — kullanıcı ürünü kurulum yapmadan görür.
  if (msg.tip === 'batchScore') {
    const { satirlar, sayfaFiyatlari } = msg.istek
    return { ok: true, veri: { sonuclar: satirlar.map(s => listeSkoru(s, sayfaFiyatlari)) } }
  }

  const anahtar = await anahtarGetir()
  if (!anahtar) return { ok: false, hata: 'anahtarYok' }

  const { ilan, benzerFiyatlar } = msg.istek
  // Maske çağrıdan ÖNCE: telefon/IBAN/TCKN/plaka Google'a gitmesin. Sunucu yokken de
  // vazgeçilmez — ilan sahibinin kişisel verisi ilanı okuyan kullanıcının değil.
  maskeleIlan(ilan)

  const ist = ilan.fiyat ? fiyatIstatistik(benzerFiyatlar, ilan.fiyat.tutar) : null
  const taban = ist && ilan.fiyat ? pazarlikTabani(ilan.fiyat.tutar, ist.medyan) : null
  const km = kmDurumu(ilan.km, ilan.yil, ilan.kategori, ilan.yakit, new Date().getFullYear())

  try {
    const analiz = await analyzeListing(
      geminiClient({ apiKey: anahtar, fetcher }), VARSAYILAN_MODEL, ilan, ist, taban, null, km
    )
    if (!analiz) return { ok: false, hata: 'ai' }
    const sonuc = AnalysisResultSchema.parse({
      ...analiz,
      pazarlikHedefi: taban ? Math.round(clampPazarlik(analiz.pazarlikHedefi, taban)) : analiz.pazarlikHedefi,
      fiyatIstatistik: ist,
      kmDurum: km,
      // Kronik sorunlar sunucu tarafındaydı (web araması + paylaşılan önbellek).
      // Sunucu kalkınca bu katman da kalktı; ileride kullanıcının kendi anahtarıyla
      // tarayıcıda üretilebilir. Uydurma liste göstermektense boş bırakmak doğrusu.
      kronikSorunlar: []
    })
    return { ok: true, veri: sonuc }
  } catch (e) {
    // Kullanıcı kendi anahtarını kullanıyor: "kredi bitti" ile "kota doldu" ile
    // "anahtar geçersiz" onun için ÜÇ AYRI eylem demek. Tek hataya indirmek,
    // kullanıcıyı ne yapacağını bilmez hâlde bırakır.
    if (e instanceof AiKrediHatasi) return { ok: false, hata: 'anahtarSorunu' }
    if (e instanceof AiHizLimitiHatasi) return { ok: false, hata: 'hizLimiti' }
    return { ok: false, hata: 'ag' }
  }
}

if (typeof chrome !== 'undefined' && tarayici.runtime?.onMessage) {
  tarayici.runtime.onInstalled?.addListener(() => { eskiDepoyuTemizle().catch(() => {}) })
  tarayici.runtime.onMessage.addListener((msg: IstekMesaj, _sender, sendResponse) => {
    handleMesaj(msg).then(sendResponse)
    return true // async cevap
  })
}

// Eski sürümlerden kalan artıklar: sahibinden'den çekilen arama sayfaları ('benzer:*'),
// istek sayaçları ve artık kullanılmayan oturum/cihaz kayıtları. Hesap sistemi kalktığı
// için oturum jetonu da silinir — kullanıcının makinesinde öksüz veri bırakmayalım.
export async function eskiDepoyuTemizle(): Promise<void> {
  const tumu = await tarayici.storage.local.get(null)
  const cop = Object.keys(tumu).filter(k =>
    k.startsWith('benzer:') || k === 'benzerIstekler' || k === 'supabaseOturum' || k === 'cihazId')
  if (cop.length) await tarayici.storage.local.remove(cop)
}
