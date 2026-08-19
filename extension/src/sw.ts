import {
  geminiClient, listeSkoru, AiKrediHatasi, AiHizLimitiHatasi
} from 'shared'
import { ExtensionServiceWorkerMLCEngineHandler } from '@mlc-ai/web-llm'
import type { IstekMesaj, CevapMesaj } from './mesaj'
import { analizCalistir } from './analizCalistir'
import { anahtarGetir, VARSAYILAN_MODEL } from './anahtar'
import { tarayici } from './tarayici'

// Sunucumuz analiz akışında yok. Varsayılan yerel model WebGPU ile cihazda çalışır;
// Gemini seçilirse kullanıcının anahtarı yalnız bu service worker'da okunur ve doğrudan
// Google'a gider. İlan içeriği bizim hiçbir sistemimize uğramaz; hesap ve ödeme yoktur.

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

  try {
    const analiz = await analizCalistir(
      geminiClient({ apiKey: anahtar, fetcher }), VARSAYILAN_MODEL, msg.istek
    )
    if (!analiz) return { ok: false, hata: 'ai' }
    return { ok: true, veri: analiz }
  } catch (e) {
    // Kullanıcı kendi anahtarını kullanıyor: "kredi bitti" ile "kota doldu" ile
    // "anahtar geçersiz" onun için ÜÇ AYRI eylem demek. Tek hataya indirmek,
    // kullanıcıyı ne yapacağını bilmez hâlde bırakır.
    if (e instanceof AiKrediHatasi) return { ok: false, hata: 'anahtarSorunu' }
    if (e instanceof AiHizLimitiHatasi) return { ok: false, hata: 'hizLimiti' }
    return { ok: false, hata: 'ag' }
  }
}

let yerelHandler: ExtensionServiceWorkerMLCEngineHandler | null = null

function yerelModelPortunuBagla(port: chrome.runtime.Port): void {
  if (port.name !== 'web_llm_service_worker') return

  if (!yerelHandler) yerelHandler = new ExtensionServiceWorkerMLCEngineHandler(port)
  else yerelHandler.setPort(port)
  port.onMessage.addListener(yerelHandler.onmessage.bind(yerelHandler))
}
if (typeof chrome !== 'undefined' && tarayici.runtime?.onMessage) {
  tarayici.runtime.onInstalled?.addListener(() => { eskiDepoyuTemizle().catch(() => {}) })
  tarayici.runtime.onConnect?.addListener(yerelModelPortunuBagla)
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
