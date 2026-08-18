import { tarayici } from './tarayici'

// Kullanıcının kendi Gemini API anahtarı. Uzantı ücretsiz; analiz maliyeti
// kullanıcının kendi hesabından çıkıyor ve anahtar BİZİM SUNUCUMUZA HİÇ UĞRAMIYOR.
//
// Anahtar yalnız uzantı bağlamında (service worker + popup) okunuyor; content
// script'e hiç geçmiyor. Sahibinden/arabam sayfasındaki kod ele geçse bile anahtara
// ulaşamaz — oturum jetonunda uyguladığımız desenin aynısı.
const DEPO = 'geminiAnahtar'
const TEMEL = 'https://generativelanguage.googleapis.com/v1beta'

export const VARSAYILAN_MODEL = 'gemini-flash-lite-latest'

export async function anahtarGetir(): Promise<string | null> {
  return (await tarayici.storage.local.get(DEPO))[DEPO] ?? null
}

export async function anahtarKaydet(anahtar: string): Promise<void> {
  await tarayici.storage.local.set({ [DEPO]: anahtar.trim() })
}

export async function anahtarSil(): Promise<void> {
  await tarayici.storage.local.remove(DEPO)
}

export type DogrulamaSonuc = { ok: true } | { ok: false; hata: string }

export const ANAHTAR_HATA: Record<string, string> = {
  bos: 'Anahtar boş olamaz.',
  gecersiz: 'Bu anahtar geçerli değil. Google AI Studio’dan kopyaladığından emin ol.',
  yetki: 'Anahtar bu API için yetkili değil. Google AI Studio’da Gemini API’nin açık olduğunu kontrol et.',
  kota: 'Anahtarın kotası dolu görünüyor. Google AI Studio’dan kullanım limitine bak.',
  ag: 'Google’a ulaşılamadı. İnternet bağlantını kontrol et.'
}

// Doğrulama TEK MODEL SORGUSU ile yapılıyor: token harcamıyor, ücretsiz, ve hem
// anahtarın geçerliliğini hem de kullanacağımız modelin erişilebilir olduğunu birlikte
// gösteriyor. Analiz çağrısıyla doğrulamak kullanıcıya boşuna para harcatırdı.
export async function anahtarDogrula(
  anahtar: string, fetcher: typeof fetch = fetch, model = VARSAYILAN_MODEL
): Promise<DogrulamaSonuc> {
  const temiz = anahtar.trim()
  if (!temiz) return { ok: false, hata: 'bos' }
  let res: Response
  try {
    res = await fetcher(`${TEMEL}/models/${model}`, { headers: { 'x-goog-api-key': temiz } })
  } catch {
    return { ok: false, hata: 'ag' }
  }
  if (res.ok) return { ok: true }
  // Google geçersiz anahtara 400 "API key not valid" veriyor; 403 yetki, 429 kota.
  if (res.status === 429) return { ok: false, hata: 'kota' }
  if (res.status === 403) return { ok: false, hata: 'yetki' }
  return { ok: false, hata: 'gecersiz' }
}

// Anahtarı ekranda gösterirken tamamını yazmıyoruz: popup omuz üstünden okunabilir
// ve kullanıcı ekran görüntüsü paylaşabiliyor. Baş/son birkaç karakter tanımaya yeter.
export function anahtarMaskele(anahtar: string): string {
  if (anahtar.length <= 12) return '•'.repeat(anahtar.length)
  return `${anahtar.slice(0, 6)}${'•'.repeat(10)}${anahtar.slice(-4)}`
}
