import {
  PaylasimOkuSchema, PaylasimYazSonucSchema,
  type PaylasilanAnaliz, type PaylasimOku, type PaylasimYazDurum
} from 'shared'
import { tarayici } from './tarayici'

// PAYLAŞILAN ÖNBELLEK — uzantı tarafı.
//
// Karşılıklı ve gönüllü: katılan kullanıcı başkalarının ürettiği analizleri görür,
// kendi ürettiklerini de paylaşır. Katılmayan hiçbir şey görmez ve hiçbir şey vermez.
//
// ÜÇ KATMANLI KAPALILIK — biri atlansa öbürü tutar:
//   1. Derleme: PAYLASIM_KOK verilmeden derlenen pakette adres YOK, kod ölü.
//   2. İzin: adres `optional_host_permissions`ta. Kullanıcı onaylamadan tarayıcı
//      bu isteği ENGELLER — kodda bir hata olsa bile ağa çıkılamaz.
//   3. Tercih: kullanıcının açık onayı yerel depoda; izin verilmiş olsa bile
//      tercih kapalıysa istek kurulmaz.
//
// Sunucuya GİDEN: 64 karakterlik özet + analiz metni. GİTMEYEN: API anahtarı, ilan
// adresi, ilan başlığı, satıcının açıklaması, kullanıcı kimliği.

// Derleme zamanı sabiti (build.mjs → esbuild define). Verilmezse özellik yok.
declare const __PAYLASIM_KOK__: string
export const PAYLASIM_KOK: string =
  typeof __PAYLASIM_KOK__ === 'string' ? __PAYLASIM_KOK__ : ''

const DEPO_ACIK = 'paylasimAcik'
const DEPO_KIMLIK = 'istemciKimlik'

// Okuma isteği ANALİZİ BEKLETMEZ. Sunucu yavaşsa ya da erişilemiyorsa kullanıcı
// bunu fark bile etmemeli: zaman aşımında sessizce kendi anahtarıyla üretilir.
// Bu yüzden süre kısa — bekleyerek kazanılacak bir şey yok, kaybedilecek var.
const OKUMA_ZAMAN_ASIMI_MS = 2500
const YAZMA_ZAMAN_ASIMI_MS = 4000

export type PaylasimAyar = { kok: string; kimlik: string }

// İstemci kimliği HESAP DEĞİL: rastgele bir UUID, kimseye bağlı değil, kullanıcı
// istediğinde yenileyebiliyor, kapatınca siliniyor. Tek işi sunucunun hız limitini
// IP'den daha ince taneli uygulaması — CGNAT arkasındaki binlerce kullanıcı aksi
// hâlde tek sayaca düşer ve birbirini limitler.
async function kimlikGetir(): Promise<string> {
  const v = (await tarayici.storage.local.get(DEPO_KIMLIK))[DEPO_KIMLIK]
  if (typeof v === 'string' && v) return v
  const yeni = crypto.randomUUID()
  await tarayici.storage.local.set({ [DEPO_KIMLIK]: yeni })
  return yeni
}

const kokDeseni = (kok: string) => `${kok.replace(/\/+$/, '')}/*`

export async function izinVarMi(kok = PAYLASIM_KOK): Promise<boolean> {
  if (!kok) return false
  // İzin tarayıcı ayarlarından geri alınabiliyor. Her seferinde soruyoruz ki
  // kullanıcı chrome://extensions üzerinden kapattığında anında etkili olsun —
  // yalnız kendi bayrağımıza güvenmek onu görmezden gelmek olurdu.
  return !!(await tarayici.permissions?.contains({ origins: [kokDeseni(kok)] }))
}

// Kullanıcı tercihi + izin birlikte. Biri eksikse paylaşım YOK.
//
// KENDİNİ ONARIR: izin geri alınmışsa bayrak da indirilir. İkisi ayrışmış hâlde
// kalırsa arayüz ile gerçek davranış birbirini tutmuyor ve kullanıcı "açık" gördüğü
// bir özelliğin neden çalışmadığını anlayamıyor.
export async function paylasimAyari(kok = PAYLASIM_KOK): Promise<PaylasimAyar | null> {
  if (!kok) return null
  const tercih = (await tarayici.storage.local.get(DEPO_ACIK))[DEPO_ACIK] === true
  const izin = await izinVarMi(kok)
  if (!izin) {
    if (tercih) await tarayici.storage.local.set({ [DEPO_ACIK]: false })
    return null
  }
  if (!tercih) return null
  return { kok: kok.replace(/\/+$/, ''), kimlik: await kimlikGetir() }
}

// Açma AKIŞI POPUP'TA çalışmalı: permissions.request kullanıcı hareketi istiyor,
// service worker'dan çağrılırsa tarayıcı sessizce reddediyor.
//
// TERCİH İZİNDEN ÖNCE YAZILIR ve sırası hayatidir. Chrome, permissions.request()
// izin diyaloğunu açtığında action popup'ını KAPATIYOR; belge yok edilince
// await'ten sonraki satırlar hiç çalışmıyor. Tercihi sonra yazan sürüm bu yüzden
// canlıda şunu üretti: kullanıcı izni verdi, bayrak hiç yazılmadı, özellik sessizce
// kapalı kaldı ve hiçbir istek çıkmadı — üstelik popup "Açık" gösteriyordu.
//
// Önce yazmanın bedeli, kullanıcı diyaloğu reddederse bayrağın açık kalması. Bu
// zararsız: izin kapısı zaten geçilmiyor, ve iki yerde temizleniyor — burada geri
// alınarak, paylasimAyari'de de kendini onararak.
export async function paylasimAc(kok = PAYLASIM_KOK): Promise<boolean> {
  if (!kok) return false
  await tarayici.storage.local.set({ [DEPO_ACIK]: true })
  await kimlikGetir()
  const verildi = await tarayici.permissions?.request({ origins: [kokDeseni(kok)] })
  // Buraya ulaşabildiysek popup hayatta demektir; reddedildiyse geri al.
  if (!verildi) {
    await tarayici.storage.local.set({ [DEPO_ACIK]: false })
    return false
  }
  return true
}

// Arayüzün göstereceği durum: GERÇEK kapı, yalnız izin değil. İzne bakmak, tercih
// yazılamamış bir kurulumda "Açık" gösterip hiçbir istek atmamak demekti.
export async function paylasimAcikMi(kok = PAYLASIM_KOK): Promise<boolean> {
  return (await paylasimAyari(kok)) != null
}

// Kapatınca izin de GERİ ALINIR ve kimlik SİLİNİR. Yalnız bayrağı indirmek,
// kullanıcının "kapattım" dediği şeyi yarım kapatmak olurdu: uzantının adrese
// çıkma yetkisi durmaya devam ederdi.
export async function paylasimKapat(kok = PAYLASIM_KOK): Promise<void> {
  await tarayici.storage.local.set({ [DEPO_ACIK]: false })
  await tarayici.storage.local.remove(DEPO_KIMLIK)
  if (kok) await tarayici.permissions?.remove({ origins: [kokDeseni(kok)] })
}

export type PaylasimIstemci = {
  oku(anahtar: string): Promise<PaylasimOku | null>
  // Sunucunun kararını döndürür; ulaşılamazsa null. Panel bunu yalnız kullanıcı
  // AÇIKÇA yenilediğinde gösteriyor — normal analizde "yazildi" bilgisi gürültü.
  yaz(anahtar: string, analiz: PaylasilanAnaliz): Promise<PaylasimYazDurum | null>
}

// Ağ hataları KULLANICIYA YANSIMAZ. Paylaşılan önbellek bir kolaylık katmanı;
// çöktüğünde doğru davranış, hiç yokmuş gibi davranmaktır. Buradan fırlayan bir
// istisna analiz akışını düşürürdü — sunucu arızasını kullanıcının sorunu yapmak.
export function paylasimIstemcisi(ayar: PaylasimAyar, fetcher: typeof fetch = fetch): PaylasimIstemci {
  const baslik = { 'x-istemci-kimlik': ayar.kimlik }
  return {
    async oku(anahtar) {
      try {
        const res = await fetcher(`${ayar.kok}/v1/onbellek/${anahtar}`, {
          headers: baslik, signal: AbortSignal.timeout(OKUMA_ZAMAN_ASIMI_MS)
        })
        if (!res.ok) return null // 404 isabetsizlik, 429 limit — ikisi de sessiz
        const cozum = PaylasimOkuSchema.safeParse(await res.json())
        // Şemaya uymayan yanıt = güvenilmez sunucu. Panele basmaktansa yok say:
        // bu metin kullanıcıya gösterilecek, doğrulaması sunucuya bırakılamaz.
        return cozum.success ? cozum.data : null
      } catch { return null }
    },
    async yaz(anahtar, analiz) {
      try {
        const res = await fetcher(`${ayar.kok}/v1/onbellek`, {
          method: 'POST',
          headers: { ...baslik, 'content-type': 'application/json' },
          body: JSON.stringify({ anahtar, analiz }),
          signal: AbortSignal.timeout(YAZMA_ZAMAN_ASIMI_MS)
        })
        if (!res.ok) return null // 429 limit, 422 denetim — kullanıcıyı ilgilendirmiyor
        const cozum = PaylasimYazSonucSchema.safeParse(await res.json())
        return cozum.success ? cozum.data.durum : null
      } catch { return null /* paylaşamadık; kullanıcının sonucu zaten elinde */ }
    }
  }
}
