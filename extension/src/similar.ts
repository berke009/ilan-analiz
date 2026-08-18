import type { ListingDetail, ListRow } from 'shared'
import { ozellikCikar } from './ozellik'
import { tarayici } from './tarayici'

// KIRMIZI ÇİZGİ: buradan hiçbir ağ isteği çıkmaz.
//
// Karşılaştırma satırları YALNIZ kullanıcının kendi açtığı liste sayfasının DOM'undan
// gelir (bkz. listeAkisi.ts). Bu proje hiçbir koşulda kendiliğinden sayfa istemez:
// ne crawler, ne zamanlanmış görev, ne arka plan çekimi. Katkı verirken bu kuralı
// koru — testler de bunu zorluyor (test/similar.test.ts, "ağ erişimi yok").

export type BenzerSonuc = { satirlar: ListRow[]; fiyatlar: number[] }

const ANAHTAR = 'listeDepo'
const SAKLAMA_MS = 24 * 60 * 60_000
// Depo tek bir kayıtta tutulur: sınırı aşmak storage.local.set'i patlatır, o da
// liste sayfasında rozetleri sessizce öldürürdü. En yeni N yol saklanır.
const EN_FAZLA_YOL = 12

type Kayit = { satirlar: ListRow[]; ts: number }

export type ListeDepo = {
  get(yol: string): Promise<ListRow[] | null>
  set(yol: string, satirlar: ListRow[]): Promise<void>
}

export function listeDepo(): ListeDepo {
  const tumu = async (): Promise<Record<string, Kayit>> =>
    (await tarayici.storage.local.get(ANAHTAR))[ANAHTAR] ?? {}
  return {
    async get(yol) {
      const k = (await tumu())[yol]
      return k && Date.now() - k.ts < SAKLAMA_MS ? k.satirlar : null
    },
    async set(yol, satirlar) {
      const d = { ...(await tumu()), [yol]: { satirlar, ts: Date.now() } }
      // Bayatları at, sonra en yeniden eskiye sırala ve sınırı uygula
      const taze = Object.entries(d)
        .filter(([, k]) => Date.now() - k.ts < SAKLAMA_MS)
        .sort((a, b) => b[1].ts - a[1].ts)
        .slice(0, EN_FAZLA_YOL)
      await tarayici.storage.local.set({ [ANAHTAR]: Object.fromEntries(taze) })
    }
  }
}

// Liste sayfasında çağrılır: kullanıcının GÖRDÜĞÜ satırlar o sayfanın arama yoluna yazılır.
// Yol anahtarı kritik: satırların hepsinin aynı model aramasından geldiği değişmezini korur.
// eslesenSatirlar marka/model bakmaz (yıl + vites/yakıt bakar); farklı aramaların satırları
// aynı torbaya girerse Egea ile Range Rover karşılaştırılır ve istatistik saçmalar.
// Anahtarı TEK yerde üret: yazan liste sayfası, okuyan detay sayfası. İkisi ayrı
// yerde kurulursa sessizce ayrışır ve karşılaştırma hiç eşleşmez (site öneki
// eklenirken tam bu tuzağa düşüldü). Site öneki şart: iki farklı sitede aynı yol
// (/otomobil) çakışır ve bir sitenin satırları öbürünün istatistiğine karışır.
export const depoAnahtari = (siteAd: string, yol: string) => `${siteAd}${yol}`

export async function listeSatirlariKaydet(
  siteAd: string, yol: string, satirlar: ListRow[], depo: ListeDepo
): Promise<void> {
  if (satirlar.length === 0) return
  await depo.set(depoAnahtari(siteAd, yol), satirlar)
}

export function filtreleBenzer(satirlar: ListRow[], yil: number, delta: number, haricIlanId: string): number[] {
  return satirlar
    .filter(s => s.ilanId !== haricIlanId && s.fiyat?.paraBirimi === 'TL' && s.yil != null && Math.abs(s.yil - yil) <= delta)
    .map(s => s.fiyat!.tutar)
}

// ozellikFiltresi=false: vites/yakıt eşleşmesi aranmaz. Örneklem 5'in altına düşünce
// hiç istatistik göstermemektense yıl bandını koruyup bu filtreyi bırakmak daha iyi.
export function eslesenSatirlar(
  satirlar: ListRow[], ilan: ListingDetail, delta: number, ozellikFiltresi = true
): ListRow[] {
  // güvenilir alanlar (detay sayfasının Vites/Yakıt satırları) ÖNCE gelmeli:
  // ozellikCikar erken eşleşmeyi seçiyor, sonra verilirse başlıktaki reklam metni onları ezer
  const hedefOzellik = ozellikCikar(ilan.vites, ilan.yakit, ilan.model, ilan.baslik)
  return satirlar.filter(s => {
    if (s.ilanId === ilan.ilanId) return false
    if (s.fiyat?.paraBirimi !== 'TL' || !(s.fiyat.tutar > 0)) return false
    if (ilan.yil == null || s.yil == null || Math.abs(s.yil - ilan.yil) > delta) return false
    if (!ozellikFiltresi) return true
    const adayOzellik = ozellikCikar(s.model, s.baslik)
    // yalnız hedef VE aday özelliği biliniyor ve farklıysa ele; aday bilinmiyorsa (null) tut
    if (hedefOzellik.vites != null && adayOzellik.vites != null && adayOzellik.vites !== hedefOzellik.vites) return false
    if (hedefOzellik.yakit != null && adayOzellik.yakit != null && adayOzellik.yakit !== hedefOzellik.yakit) return false
    return true
  })
}

const YETER = 5

// Örneklemi büyütme merdiveni: önce yıl bandını (±2 → ±4), o da yetmezse vites/yakıt
// filtresini bırak. Hepsi tükenirse çağıran bir üst arama yoluna geçer.
function orneklemSec(tumSatirlar: ListRow[], ilan: ListingDetail): ListRow[] | null {
  for (const ozellikFiltresi of [true, false]) {
    for (const delta of [2, 4]) {
      const s = eslesenSatirlar(tumSatirlar, ilan, delta, ozellikFiltresi)
      if (s.length >= YETER) return s
    }
  }
  return null
}

// Detay sayfasında çağrılır. Ağ yok: kullanıcının daha önce açtığı liste sayfasından
// saklanan satırlara bakar. Kullanıcı doğrudan ilana düştüyse (Google, paylaşılan link)
// elde satır olmaz ve null döner — panel fiyat konumu olmadan çalışmaya devam eder.
export async function benzerIlanlarBul(
  ilan: ListingDetail, depo: ListeDepo, siteAd: string
): Promise<BenzerSonuc | null> {
  if (!ilan.yil) return null
  // en derin kırıntı donanım seviyesinde olabiliyor (/mercedes-benz-c-serisi-c-200-amg);
  // kullanıcı genelde bir üst seviyede (seri/model) listeliyor, o yüzden ikisi de denenir
  const yollar = [ilan.modelAramaPath, ilan.ustAramaPath].filter((y): y is string => !!y)

  for (const yol of yollar) {
    const satirlar = await depo.get(depoAnahtari(siteAd, yol))
    if (!satirlar) continue
    const secilen = orneklemSec(satirlar, ilan)
    if (!secilen) continue
    return { satirlar: secilen, fiyatlar: secilen.map(s => s.fiyat!.tutar) }
  }
  return null
}
