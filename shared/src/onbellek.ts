import { z } from 'zod'
import { BayrakSchema, type AnalysisResult, type FiyatIstatistik } from './schemas'

// PAYLAŞILAN ÖNBELLEK — ortak sözleşme.
//
// Bu dosya hem uzantıda hem sunucuda çalışır ve ikisinin ANLAŞTIĞI tek yerdir:
// anahtar nasıl türetilir, kayıtta ne bulunur, hangi sınırlar geçerlidir. İki tarafta
// kopyalanırsa anahtarlar sessizce ayrışır ve önbellek hiç isabet etmez — yani hata
// gürültüsüz olur, sadece hiçbir şey işe yaramaz.
//
// TASARIMIN İKİ KURALI:
//
// 1) Anahtar hiç uğramaz. Uzantı isteği sunucuya YOLLAMAZ; önbellekte yoksa Gemini'ye
//    doğrudan kendi anahtarıyla çıkar ve sonucu buraya yazar (cache-aside). Vekil
//    (proxy) olsaydık kullanıcının API anahtarı bizden geçerdi.
//
// 2) Yalnız METİN paylaşılır, SAYI paylaşılmaz. Fiyat istatistiği, km durumu ve
//    pazarlık hedefi okuyanın kendi cihazında yeniden hesaplanır (bkz. birlestir).
//    Böylece kötü niyetli bir kayıt en fazla yorum cümlelerini kirletebilir;
//    medyana, yüzdeliğe, pazarlık tabanına ulaşamaz.

// Anahtarın parçası. Prompt, model çıktısının şeması veya paylaşılan alanların anlamı
// değiştiğinde ARTIRILMALI: eski kayıtlar yeni sürüme hiç eşleşmez ve kendiliğinden
// TTL ile düşer. Artırmayı unutmak, yeni uzantının eski biçimli metni göstermesi demek.
export const PAYLASIM_SURUM = 2

// Metin uzunlukları ŞEMADA sınırlı. Sunucu tarafında gövde boyutu ayrıca sınırlanıyor
// ama asıl savunma burası: 200 KB'lık tek bir "özet" gövde limitine takılmadan geçip
// paneli ve deposu şişirebilirdi.
export const PaylasilanAnalizSchema = z.object({
  skor: z.number().min(0).max(10),
  durumEtiketi: z.string().min(1).max(40),
  chipler: z.array(z.string().min(1).max(60)).max(8),
  bayraklar: z.array(BayrakSchema.extend({ metin: z.string().min(1).max(300) })).max(10),
  avantajlar: z.array(z.string().min(1).max(300)).max(10),
  dezavantajlar: z.array(z.string().min(1).max(300)).max(10),
  ozet: z.string().min(1).max(1200),
  fiyatYorumu: z.string().max(1200)
})
export type PaylasilanAnaliz = z.infer<typeof PaylasilanAnalizSchema>

// pazarlikHedefi KASITLI OLARAK YOK. AI'ın verdiği değer zaten pazarlık tabanının
// ±%5 bandına kırpılıyor (clampPazarlik) ve taban okuyanın kendi örnekleminden
// deterministik çıkıyor. Paylaşmasak da okuyan tabanı kullanabiliyor; paylaşsak
// kötü niyetli bir kayıt kullanıcıya yanlış bir pazarlık rakamı gösterebilirdi.

export const PaylasimYazSchema = z.object({
  anahtar: z.string().regex(/^[0-9a-f]{64}$/),
  analiz: PaylasilanAnalizSchema
})
export type PaylasimYaz = z.infer<typeof PaylasimYazSchema>

export const PaylasimOkuSchema = z.object({
  analiz: PaylasilanAnalizSchema,
  // Kaydın yazıldığı an (epoch ms). Panel "başka bir kullanıcıdan, N saat önce"
  // diyebilsin diye: paylaşılan sonucun tazeliği kullanıcının bilmesi gereken şey.
  ts: z.number().int().positive()
})
export type PaylasimOku = z.infer<typeof PaylasimOkuSchema>

// Fiyat yorumu, yazan kişinin KENDİ örneklemine bakarak üretiliyor. Örneklemi olmayan
// birine "medyanın %12 altında" cümlesini servis etmek panelde çelişki yaratır: metin
// bir fiyat konumundan bahseder, üstündeki kutu boştur. Bu yüzden istatistik durumu
// ANAHTARIN PARÇASI — örneklemi olan olanın kaydını, olmayan olmayanın kaydını görür.
//
// Ondalık dilime yuvarlıyoruz: iki kullanıcının örneklemi birebir aynı olmaz ama aynı
// dilime düşüyorlarsa fiyat yorumu ikisi için de doğrudur. Tam yüzdelikle anahtarlamak
// önbelleği 100 parçaya böler ve isabet oranını sıfıra yaklaştırırdı.
export function istatistikDilimi(ist: FiyatIstatistik | null): string {
  return ist ? `d${Math.round(ist.yuzdelik / 10)}` : 'yok'
}

// Anahtar İLAN METNİ İÇERMEZ: yalnız ilan kimliği, fiyat ve model/sürüm damgası.
// SHA-256 tek yönlü — sunucu elindeki anahtardan hangi ilana ait olduğunu çözemez,
// ancak elinde ilan kimliği zaten olan biri (yani o ilanı açan kullanıcı) sorabilir.
export async function onbellekAnahtari(girdi: {
  site: string
  ilanId: string
  fiyat: number
  model: string
  istDilim: string
}): Promise<string> {
  const ham = [
    PAYLASIM_SURUM, girdi.site, girdi.ilanId,
    Math.round(girdi.fiyat), girdi.model, girdi.istDilim
  ].join('|')
  const ozet = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ham))
  return [...new Uint8Array(ozet)].map(b => b.toString(16).padStart(2, '0')).join('')
}

// Tam sonuçtan paylaşılabilir kısmı ayıkla. Alanları TEK TEK sayıyoruz; yayma
// (spread) kullanmak, şemaya sonradan eklenen bir alanın habersizce paylaşıma
// sızması demekti.
export function paylasimaHazirla(sonuc: AnalysisResult): PaylasilanAnaliz {
  return {
    skor: sonuc.skor,
    durumEtiketi: sonuc.durumEtiketi,
    chipler: sonuc.chipler,
    bayraklar: sonuc.bayraklar,
    avantajlar: sonuc.avantajlar,
    dezavantajlar: sonuc.dezavantajlar,
    ozet: sonuc.ozet,
    fiyatYorumu: sonuc.fiyatYorumu
  }
}

// Paylaşılan metni okuyanın KENDİ deterministik hesaplarıyla birleştir. Sayılar
// buradan gelir, önbellekten değil — kuralın uygulandığı tek nokta burasıdır.
export function birlestir(
  analiz: PaylasilanAnaliz,
  yerel: { fiyatIstatistik: FiyatIstatistik | null; kmDurum: AnalysisResult['kmDurum']; pazarlikHedefi: number | null }
): AnalysisResult {
  return {
    ...analiz,
    pazarlikHedefi: yerel.pazarlikHedefi,
    fiyatIstatistik: yerel.fiyatIstatistik,
    kmDurum: yerel.kmDurum,
    // Kronik sorunlar hattı sunucu kalkarken düşmüştü; paylaşımla geri gelmiyor.
    kronikSorunlar: []
  }
}
