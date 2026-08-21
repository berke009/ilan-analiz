import {
  AnalysisResultSchema, geminiClient, analyzeListing, maskeleIlan,
  fiyatIstatistik, pazarlikTabani, clampPazarlik, kmDurumu, listeSkoru,
  AiKrediHatasi, AiHizLimitiHatasi,
  onbellekAnahtari, istatistikDilimi, paylasimaHazirla, birlestir
} from 'shared'
import type { IstekMesaj, CevapMesaj } from './mesaj'
import { anahtarGetir, VARSAYILAN_MODEL } from './anahtar'
import { paylasimAyari, paylasimIstemcisi, type PaylasimIstemci } from './paylasim'
import { tarayici } from './tarayici'

// ANALİZ TAMAMEN TARAYICIDA ÜRETİLİR. Sunucu üretim akışında yok:
//   · kullanıcının API anahtarı buradan çıkmıyor, Google'a doğrudan gidiyor
//   · ilan içeriği, adresi ve satıcının açıklaması hiçbir sistemimize uğramıyor
//   · kota, hesap, ödeme yok — uzantı ücretsiz
// Anahtar YALNIZ service worker'da okunuyor; content script'e hiç geçmiyor, yani
// ilan sayfasındaki kod ele geçse bile anahtara ulaşamaz.
//
// PAYLAŞILAN ÖNBELLEK (varsayılan KAPALI, bkz. paylasim.ts) bunu değiştirmez:
// vekil değil, yan yol. Önbellekte kayıt varsa Gemini'ye hiç gidilmez; yoksa istek
// yine DOĞRUDAN kullanıcının anahtarıyla Google'a gider ve sonucun yalnız metin
// kısmı sunucuya bırakılır. Sunucu hiçbir koşulda araya girmez.

export async function handleMesaj(
  msg: IstekMesaj, fetcher: typeof fetch = fetch,
  // Paylaşılan önbellek istemcisi ya da null. Varsayılan: tercih + izin + derlenmiş
  // adres üçü de varsa kurulur, yoksa null. Testler buraya sahte istemci geçiriyor.
  paylasimKur: () => Promise<PaylasimIstemci | null> = async () => {
    const ayar = await paylasimAyari()
    return ayar ? paylasimIstemcisi(ayar, fetcher) : null
  }
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

  // Anahtar paylaşılan önbellek isabetinde de ARANIR. Katılım karşılıklı: kendi
  // anahtarıyla üretip paylaşmayan biri başkalarının ürettiğini de görmemeli, yoksa
  // herkesin beklediği ve kimsenin doldurmadığı bir önbellek olur.
  const anahtar = await anahtarGetir()
  if (!anahtar) return { ok: false, hata: 'anahtarYok' }

  const { ilan, benzerFiyatlar } = msg.istek
  // Maske çağrıdan ÖNCE: telefon/IBAN/TCKN/plaka Google'a gitmesin. Paylaşılan
  // önbellek için ayrıca kritik — maskelenmemiş metin başka kullanıcılara dağılırdı.
  // İlan sahibinin kişisel verisi ilanı okuyan kullanıcının değil.
  maskeleIlan(ilan)

  const ist = ilan.fiyat ? fiyatIstatistik(benzerFiyatlar, ilan.fiyat.tutar) : null
  const taban = ist && ilan.fiyat ? pazarlikTabani(ilan.fiyat.tutar, ist.medyan) : null
  const km = kmDurumu(ilan.km, ilan.yil, ilan.kategori, ilan.yakit, new Date().getFullYear())

  // Paylaşılan önbellek yolu. Ayar yoksa (tercih kapalı, izin yok ya da adres
  // derlenmemiş) bu blok hiç çalışmaz ve akış bugünküyle birebir aynı kalır.
  const istemci = ilan.fiyat ? await paylasimKur() : null
  const onbellekAnahtar = istemci && ilan.fiyat
    ? await onbellekAnahtari({
      site: msg.istek.siteAd ?? 'bilinmeyen',
      ilanId: ilan.ilanId,
      fiyat: ilan.fiyat.tutar,
      model: VARSAYILAN_MODEL,
      // Fiyat yorumu yazanın örneklemine dayanıyor. İstatistik durumu anahtarın
      // parçası olmasaydı, örneklemi olmayan kullanıcıya "medyanın altında" diyen
      // bir metin servis edilir, üstündeki fiyat kutusu ise boş kalırdı.
      istDilim: istatistikDilimi(ist)
    })
    : null

  if (istemci && onbellekAnahtar) {
    const kayit = await istemci.oku(onbellekAnahtar)
    if (kayit) {
      // SAYILAR ÖNBELLEKTEN GELMEZ. Fiyat istatistiği, km durumu ve pazarlık hedefi
      // burada, bu cihazda yeniden hesaplanıyor — kötü niyetli bir kayıt en fazla
      // yorum cümlelerini kirletebilir, rakamlara ulaşamaz.
      const sonuc = AnalysisResultSchema.parse(birlestir(kayit.analiz, {
        fiyatIstatistik: ist,
        kmDurum: km,
        pazarlikHedefi: taban ? Math.round(clampPazarlik(null, taban)) : null
      }))
      return { ok: true, veri: sonuc, kaynak: 'paylasilan', paylasimTs: kayit.ts }
    }
  }

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
    // Paylaşım: yalnız metin kısmı gider (paylasimaHazirla alanları tek tek seçiyor).
    // Bekliyoruz, ateşle-unut yapmıyoruz: MV3 service worker'ı mesaj işleyicisi
    // çözülür çözülmez sonlandırabiliyor ve serbest bırakılan istek yolda kesilirdi.
    if (istemci && onbellekAnahtar) await istemci.yaz(onbellekAnahtar, paylasimaHazirla(sonuc))
    return { ok: true, veri: sonuc, kaynak: 'kendi' }
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
