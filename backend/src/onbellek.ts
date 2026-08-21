import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { PaylasimYazSchema, maskeleMetin, type PaylasilanAnaliz } from 'shared'
import type { Depo } from './depo'
import { limitDene } from './limit'
import type { Ayar } from './yapilandirma'

// PAYLAŞILAN ÖNBELLEK UÇLARI.
//
// Sunucu ANALİZ ÜRETMEZ, model çağırmaz, API anahtarı görmez. Yaptığı tek şey:
// uzantıların kendi anahtarlarıyla ürettiği metinleri bir anahtarın altında tutup
// aynı ilanı açan başka bir kullanıcıya vermek. Katılım karşılıklı ve gönüllü —
// uzantı tarafında varsayılan kapalı (bkz. extension/src/paylasim.ts).
//
// Sunucunun GÖRDÜĞÜ ŞEY: 64 karakterlik bir özet ve analiz metni. Görmediği şey:
// ilan adresi, ilan başlığı, satıcının açıklaması, kullanıcının kimliği, API anahtarı.

const ANAHTAR_BICIM = /^[0-9a-f]{64}$/
// İstemci kimliği uzantıda üretilen rastgele bir UUID. Hesap DEĞİL: kimseye
// bağlanmıyor, kullanıcı istediğinde yeniliyor, sunucu yanında hiçbir şey tutmuyor.
// Tek işi hız limitini IP'den daha ince taneli uygulamak. Taklit edilebilir olması
// sorun değil — arkasında IP limiti ve genel tavan var.
const KIMLIK_BICIM = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Bir kaydın metin alanları. Denetim bunların üstünden geçer.
function metinler(a: PaylasilanAnaliz): string[] {
  return [a.durumEtiketi, a.ozet, a.fiyatYorumu, ...a.chipler, ...a.avantajlar,
    ...a.dezavantajlar, ...a.bayraklar.map(b => b.metin)]
}

// Bağlantı ve iletişim bilgisi: paylaşılan bir metin kutusunun ilk kötüye kullanımı
// her zaman reklamdır. Analiz metninde alan adının işi yok — model bunları üretmiyor,
// üretiyorsa da o kayıt paylaşılmaya değmez.
const BAGLANTI = /(?:https?:\/\/|www\.|\b[a-z0-9][a-z0-9-]*\.(?:com|net|org|io|co|xyz|shop|site|online|tr)\b)/i
// Ham kontrol karakteri: panele gömülü metin olarak giriyor ama logu ve JSON'u bozar.
const KONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/

export type DenetimSonuc = { ok: true } | { ok: false; sebep: 'pii' | 'baglanti' | 'kontrol' }

// İTİRAZ: çakışan yazmayı zehir temizliğine çevirme.
//
// Aynı anahtara ikinci bir yazma geldiğinde kayıt EZİLMEZ (ilk yazan kazanır). Ama o
// yazma bir sinyal taşıyor ve şimdiye kadar çöpe atılıyordu: ikinci kullanıcı, aynı
// ilan için kendi anahtarıyla BAĞIMSIZ bir sonuç üretti. Skorlar birbirine yakınsa
// kayıt doğrulanmış demektir; uçurum varsa ikisinden biri yanlıştır.
//
// TTL UZATMAK TAM TERSİ OLURDU: kayıt zehirliyse ikinci yazan dürüst kullanıcıdır ve
// yazması reddedilir — o reddedilen yazmayla süreyi uzatmak, zehri düzeltmeye çalışan
// herkesin zehrin ömrünü uzatması demek olurdu. Aynı sinyali silme yönünde kullanmak
// bu yüzden doğru yön.
//
// Yanlış tarafa düşme maliyeti düşük: silinen kayıt = önbellek isabetsizliği = ürünün
// zaten varsayılan davranışı. Kötü niyetli biri ayrışan iki yazmayla bir ilanı
// önbelleğe alınamaz hâle getirebilir; kazandığı şey, kimsenin zarar görmediği bir
// durum. Zehirlemenin bedeliyle karşılaştırıldığında bu takas bilinçli.
const AYRISMA_ESIGI = 3      // 0-10 skorda: bağımsız iki üretim ±1.5 bandında oynar, 3 gerçek uçurumdur
const ITIRAZ_ESIGI = 2       // tek itiraz kaydı düşürmesin; iki bağımsız itiraz düşürsün

export function ayrisiyorMu(eskiSkor: number | undefined, yeniSkor: number): boolean {
  // Skor okunamadıysa ayrışma İDDİA EDİLEMEZ: bilinmeyeni itiraz saymak, bozuk tek
  // bir kaydın kendini silmesine değil, sağlam kayıtların rastgele düşmesine yol açar.
  return eskiSkor != null && Math.abs(eskiSkor - yeniSkor) >= AYRISMA_ESIGI
}

// Paylaşıma açılan metnin denetimi.
//
// PII kontrolü yazanın DEĞİL, ilan sahibinin verisini koruyor: uzantı maskeyi zaten
// çağrıdan önce uyguluyor (shared/src/pii.ts), yani temiz bir istemciden gelen metinde
// maskelenecek bir şey KALMAMIŞ olmalı. Maske burada bir şey değiştiriyorsa iki
// ihtimal var: istemci maskeyi atlamış ya da metni elle yazmış. İkisi de reddi hak eder.
// Maskeleyip kabul etmiyoruz — sessizce düzeltmek, bozuk istemciyi görünmez kılardı.
export function denetle(analiz: PaylasilanAnaliz): DenetimSonuc {
  for (const m of metinler(analiz)) {
    if (KONTROL.test(m)) return { ok: false, sebep: 'kontrol' }
    if (BAGLANTI.test(m)) return { ok: false, sebep: 'baglanti' }
    if (maskeleMetin(m) !== m) return { ok: false, sebep: 'pii' }
  }
  return { ok: true }
}

// Depodaki değer bozuksa (elle düzenlenmiş, eski biçim, yarım yazma) itiraz yolunu
// patlatmasın: çözülemeyen kayıt "ayrışma yok" sayılır ve akış `vardi` ile biter.
function oku(ham: string): { analiz?: { skor?: number } } | null {
  try { return JSON.parse(ham) } catch { return null }
}

export function onbellekRotalari(depo: Depo, ayar: Ayar): Hono {
  const app = new Hono()

  const kimlikAl = (c: any): string => {
    const h = (c.req.header('x-istemci-kimlik') ?? '').toLowerCase()
    // Geçersiz/eksik kimlikte IP'ye düşülür. `bilinmeyen` gibi sabit bir değere
    // düşmek, kimliği hiç göndermeyen herkesi TEK sayaca toplar ve ilk kalabalıkta
    // hepsi birbirini limitler.
    return KIMLIK_BICIM.test(h) ? h : `ip:${ipAl(c)}`
  }
  const ipAl = (c: any): string => c.req.header(ayar.ipBasligi) ?? 'yerel'

  // Kaynak denetimi. Uzantı isteklerinde tarayıcı ya uzantı şemalı bir Origin
  // gönderir ya da hiç göndermez (host_permissions'lı uzantı isteği CORS'a tabi
  // değil). İkisi de kabul. REDDEDİLEN şey http(s) kaynaklı bir sayfa: kullanıcıların
  // tarayıcısı üzerinden bu uçları döven bir siteyi durduran tek engel bu.
  const originUygun = (origin: string | undefined): boolean => {
    if (!origin) return true
    if (ayar.izinliOriginler.includes(origin)) return true
    return /^(?:chrome-extension|moz-extension|safari-web-extension):\/\//.test(origin)
  }

  app.use('*', async (c, next) => {
    const origin = c.req.header('origin')
    if (!originUygun(origin)) return c.json({ hata: 'kaynak' }, 403)
    await next()
    if (origin) {
      c.header('Access-Control-Allow-Origin', origin)
      c.header('Vary', 'Origin')
    }
  })
  app.options('*', c => {
    c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    c.header('Access-Control-Allow-Headers', 'content-type, x-istemci-kimlik')
    c.header('Access-Control-Max-Age', '86400')
    return c.body(null, 204)
  })

  const limitli = (c: any, s: { ok: false; bekleSn: number }) => {
    c.header('Retry-After', String(s.bekleSn))
    return c.json({ hata: 'limit', bekleSn: s.bekleSn }, 429)
  }

  app.get('/onbellek/:anahtar', async c => {
    const anahtar = c.req.param('anahtar')
    if (!ANAHTAR_BICIM.test(anahtar)) return c.json({ hata: 'anahtar' }, 400)

    for (const [alan, kimlik, kurallar] of [
      ['okuma', kimlikAl(c), ayar.limit.okumaKimlik],
      ['okumaIp', ipAl(c), ayar.limit.okumaIp]
    ] as const) {
      const s = await limitDene(depo, alan, kimlik, kurallar)
      if (!s.ok) return limitli(c, s)
    }

    const ham = await depo.oku(`analiz:${anahtar}`)
    if (!ham) {
      // Isabetsizlik ÖNBELLEĞE ALINMAZ: birazdan dolabilir. Kenarda 404 tutmak,
      // ilk kullanıcı yazdıktan sonra bile herkese boş dönmek demekti.
      c.header('Cache-Control', 'no-store')
      return c.json({ hata: 'yok' }, 404)
    }
    // Kayıt TTL boyunca DEĞİŞMEZ (ilk yazan kazanır), yani kenar önbelleği güvenli.
    // Cloudflare bu yanıtı tutunca okuma yükü bizim sunucumuza hiç gelmiyor ve
    // ayrı bir Worker yazmaya gerek kalmıyor — tek bir Cache Rule yetiyor.
    //
    // stale-if-error KRİTİK: kayıt zaten değişmez olduğu için, sunucu ya da tünel
    // düştüğünde bayat kopyayı servis etmek DOĞRU davranış. Bu direktif olmadan
    // origin arızası, elde geçerli veri dururken kullanıcıya isabetsizlik olarak
    // dönerdi ve herkes kotasını yeniden harcardı.
    c.header('Cache-Control',
      `public, max-age=300, s-maxage=${Math.min(3600, ayar.ttlSn)}` +
      `, stale-while-revalidate=600, stale-if-error=${ayar.ttlSn}`)
    return c.body(ham, 200, { 'content-type': 'application/json; charset=utf-8' })
  })

  app.post('/onbellek',
    bodyLimit({ maxSize: ayar.govdeSiniriBayt, onError: c => c.json({ hata: 'govde' }, 413) }),
    async c => {
      for (const [alan, kimlik, kurallar] of [
        ['yazma', kimlikAl(c), ayar.limit.yazmaKimlik],
        ['yazmaIp', ipAl(c), ayar.limit.yazmaIp],
        ['yazmaGenel', 'hepsi', ayar.limit.yazmaGenel]
      ] as const) {
        const s = await limitDene(depo, alan, kimlik, kurallar)
        if (!s.ok) return limitli(c, s)
      }

      let govde: unknown
      try { govde = await c.req.json() } catch { return c.json({ hata: 'json' }, 400) }
      const cozum = PaylasimYazSchema.safeParse(govde)
      if (!cozum.success) return c.json({ hata: 'sema' }, 400)

      const denetim = denetle(cozum.data.analiz)
      if (!denetim.ok) return c.json({ hata: denetim.sebep }, 422)

      const kayitAnahtar = `analiz:${cozum.data.anahtar}`
      // Koşullu yazma ÖNCE denenir: mutlu yol tek atomik işlem kalsın. Önce okuyup
      // sonra yazmak, iki eşzamanlı yazmanın ikisinin de "yok" görmesine yol açardı.
      const yazildi = await depo.yazYoksa(
        kayitAnahtar,
        JSON.stringify({ analiz: cozum.data.analiz, ts: Date.now() }),
        ayar.ttlSn
      )
      if (yazildi) return c.json({ durum: 'yazildi' }, 201)

      // Kayıt zaten vardı. Bu bir HATA DEĞİL: iki kullanıcı aynı ilanı aynı anda
      // açtığında normal sonuç. İstemcinin bunu hatadan ayırması gerekiyor, yoksa
      // kullanıcıya sebepsiz uyarı gösterir.
      const mevcut = await depo.oku(kayitAnahtar)
      if (mevcut && ayrisiyorMu(oku(mevcut)?.analiz?.skor, cozum.data.analiz.skor)) {
        // İtiraz sayacı kayıttan BAĞIMSIZ yaşar ve silinmez. Sayaç da silinseydi
        // saldırgan döngüye girerdi: sil, yeniden yaz, yine sil. Sayaç ayakta
        // kalınca eşiği aşmış bir anahtar TTL boyunca önbelleğe alınamaz hâlde
        // kalıyor — tartışmalı ilan paylaşılmıyor, kimse zarar görmüyor.
        const n = await depo.sayacArtir(`itiraz:${cozum.data.anahtar}`, ayar.ttlSn)
        if (n >= ITIRAZ_ESIGI) {
          await depo.sil(kayitAnahtar)
          return c.json({ durum: 'itirazlaSilindi' }, 200)
        }
        return c.json({ durum: 'itiraz' }, 200)
      }
      return c.json({ durum: 'vardi' }, 200)
    })

  return app
}
