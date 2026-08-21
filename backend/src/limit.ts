import type { Depo } from './depo'

// Hız limiti: sabit pencere sayacı.
//
// Kayan pencere daha adil ama her istek için sıralı bir yapı tutmayı gerektiriyor;
// burada korunan şey bir ödeme ucu değil, ücretsiz bir metin önbelleği. Sabit
// pencerenin sınır anındaki iki katlık patlaması bu iş için kabul edilebilir ve
// karşılığında sayaç TEK bir INCR oluyor.
//
// PENCERE ANAHTARIN İÇİNDE: `lim:okuma:<kimlik>:60:29384712`. Böylece sıfırlama
// diye bir işlem yok — pencere değişince anahtar da değişiyor ve eskisi TTL ile
// kendiliğinden düşüyor. Sayacı elle sıfırlamaya çalışmak yarış koşulu üretirdi.
export type Kural = { adet: number; pencereSn: number }
export type LimitSonuc = { ok: true } | { ok: false; bekleSn: number }

export const DAKIKA = 60
export const GUN = 24 * 3600

export async function limitDene(
  depo: Depo, alan: string, kimlik: string, kurallar: Kural[], simdi = Date.now()
): Promise<LimitSonuc> {
  let enUzunBekle = 0
  // TÜM kurallar artırılır, ilk ihlalde çıkılmaz. Erken çıkış, dakikalık limit
  // dolduğunda günlük sayacın hiç işlememesi demekti: kullanıcı dakikalık limitin
  // ucunda sürekli gezerek günlük tavanı hiç görmeden sınırsız istek atabilirdi.
  for (const kural of kurallar) {
    const pencere = Math.floor(simdi / 1000 / kural.pencereSn)
    const anahtar = `lim:${alan}:${kimlik}:${kural.pencereSn}:${pencere}`
    // TTL pencerenin iki katı: sayaç zaten pencere değişince terk ediliyor, TTL
    // yalnız çöp toplama görevinde. Saat kaymalarında erken silinmesin diye cömert.
    const n = await depo.sayacArtir(anahtar, kural.pencereSn * 2)
    if (n > kural.adet) {
      const bekle = (pencere + 1) * kural.pencereSn - Math.floor(simdi / 1000)
      enUzunBekle = Math.max(enUzunBekle, Math.max(1, bekle))
    }
  }
  return enUzunBekle > 0 ? { ok: false, bekleSn: enUzunBekle } : { ok: true }
}

// Varsayılan limitler. Hepsi ortam değişkeniyle ezilebilir (bkz. yapilandirma.ts).
//
// Okuma limitleri CÖMERT: okuma kimseye masraf çıkarmıyor ve bir kullanıcı liste
// sayfasında gezinirken arka arkaya ilan açabiliyor. Yazma limitleri DAR: her yazma
// bir Gemini çağrısının ürünü, yani gerçek bir kullanıcı dakikada onlarca yazamaz.
// Dakikada 30'un üstünü gören şey insan değildir.
export const VARSAYILAN_LIMIT = {
  okumaKimlik: [{ adet: 120, pencereSn: DAKIKA }, { adet: 3000, pencereSn: GUN }],
  yazmaKimlik: [{ adet: 30, pencereSn: DAKIKA }, { adet: 300, pencereSn: GUN }],
  // IP limitleri kimlik limitlerinden BELİRGİN ŞEKİLDE geniş: Türkiye'de mobil
  // operatörler CGNAT kullanıyor, yani binlerce gerçek kullanıcı tek IP'den
  // gelebiliyor. IP sayacı burada kimliği taklit eden birine karşı ikinci hat;
  // dar tutulursa meşru kullanıcı kitlesini toptan keser.
  okumaIp: [{ adet: 1200, pencereSn: DAKIKA }],
  yazmaIp: [{ adet: 240, pencereSn: DAKIKA }],
  // Son emniyet supabı: kimlik ve IP çeşitlendiren dağıtık bir yazma seline karşı
  // deponun büyümesini sınırlar. Aşıldığında okuma çalışmaya DEVAM eder.
  yazmaGenel: [{ adet: 20000, pencereSn: 3600 }]
} satisfies Record<string, Kural[]>
