// Paylaşılan önbelleğin deposu. Valkey (Redis'in BSD lisanslı forku, protokol uyumlu).
//
// Neden arayüz: testler gerçek bir sunucu ayağa kaldırmasın diye bellek içi bir
// uygulama gerekiyor; ayrıca kendi sunucusunda Valkey çalıştırmak istemeyen biri
// (tek kullanıcılık kurulum) bellek deposuyla da yola devam edebilsin.
//
// YÜZEY DAR TUTULDU: üç işlem. Depoya "sadece şu üç şey yapılabilir" demek, ileride
// buraya kullanıcı verisi biriktiren bir uç eklemeyi zorlaştırıyor — bu projede bu
// bir özellik, sınırlama değil.
export type Depo = {
  oku(anahtar: string): Promise<string | null>
  // İLK YAZAN KAZANIR: kayıt varsa üstüne YAZILMAZ, false döner. Zehirlenme
  // savunmasının temeli bu — kötü niyetli biri iyi bir kaydı TTL boyunca ezemez.
  yazYoksa(anahtar: string, deger: string, ttlSn: number): Promise<boolean>
  // Sayaç + ilk artışta süre damgası ATOMİK olmalı. İki ayrı komutla yapılırsa
  // ikisi arasında süreç ölünce anahtar süresiz kalır ve o kimlik/IP kalıcı olarak
  // limitlenmiş olur — kendi kullanıcılarına kalıcı 429 vermenin en sessiz yolu.
  sayacArtir(anahtar: string, pencereSn: number): Promise<number>
  saglikli(): Promise<boolean>
  kapat(): Promise<void>
}

export function bellekDepo(): Depo {
  const kutu = new Map<string, { deger: string; sonGecerlilik: number }>()
  const tazele = (k: string) => {
    const v = kutu.get(k)
    if (!v) return null
    if (Date.now() > v.sonGecerlilik) { kutu.delete(k); return null }
    return v
  }
  return {
    async oku(a) { return tazele(a)?.deger ?? null },
    async yazYoksa(a, d, ttl) {
      if (tazele(a)) return false
      kutu.set(a, { deger: d, sonGecerlilik: Date.now() + ttl * 1000 })
      return true
    },
    async sayacArtir(a, pencereSn) {
      const v = tazele(a)
      const n = v ? Number(v.deger) + 1 : 1
      // Süre yalnız İLK artışta kurulur: sabit pencere böyle çalışır, her artışta
      // uzatmak pencereyi kayan hâle getirir ve limit hiç sıfırlanmaz.
      kutu.set(a, { deger: String(n), sonGecerlilik: v?.sonGecerlilik ?? Date.now() + pencereSn * 1000 })
      return n
    },
    async saglikli() { return true },
    async kapat() { kutu.clear() }
  }
}

// INCR + (ilk artışta) EXPIRE, tek Lua betiğinde — Valkey betiği atomik çalıştırır.
const SAYAC_BETIK = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n`

export async function valkeyDepo(url: string): Promise<Depo> {
  // Dinamik import: Valkey kullanmayan kurulum (bellek deposu) paketi hiç yüklemesin,
  // ve bağımlılık eksikse sunucu gizlilik sayfasını sunmaya devam edebilsin.
  const { default: Valkey } = await import('iovalkey')
  const istemci = new Valkey(url, {
    // Bağlantı yokken istekleri KUYRUKLAMA. Kuyruklarsa paylaşılan önbellek
    // isteği Valkey geri gelene kadar asılı kalır ve uzantıdaki analiz akışı
    // önbellek yüzünden bekler — oysa önbellek isabetsizliği zararsız bir durum.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    lazyConnect: true
  })
  istemci.on('error', (e: Error) => console.log('[DEPO] valkey hatası:', e.message))
  await istemci.connect()
  return {
    async oku(a) { return istemci.get(a) },
    async yazYoksa(a, d, ttl) { return (await istemci.set(a, d, 'EX', ttl, 'NX')) === 'OK' },
    async sayacArtir(a, pencereSn) { return Number(await istemci.eval(SAYAC_BETIK, 1, a, String(pencereSn))) },
    async saglikli() { try { return (await istemci.ping()) === 'PONG' } catch { return false } },
    async kapat() { await istemci.quit() }
  }
}

// Depo düşerse SERVİS DÜŞMEZ. Önbellek isabetsizliği kullanıcı için sadece "analiz
// kendi anahtarınla üretildi" demek — yani ürünün varsayılan davranışı. Valkey
// yüzünden 500 döndürmek, olmayan bir sorunu kullanıcıya taşımak olurdu.
export function toleransli(depo: Depo): Depo {
  const yut = async <T>(is: () => Promise<T>, varsayilan: T): Promise<T> => {
    try { return await is() } catch (e) {
      console.log('[DEPO] işlem başarısız, önbelleksiz devam:', String((e as Error)?.message ?? e).slice(0, 200))
      return varsayilan
    }
  }
  return {
    oku: a => yut(() => depo.oku(a), null),
    yazYoksa: (a, d, t) => yut(() => depo.yazYoksa(a, d, t), false),
    // Sayaç okunamıyorsa limit UYGULANAMAZ demektir. 0 dönmek "limit dolmadı"
    // anlamına gelir ve depo çöktüğünde limitler tamamen açılır. Bu bilinçli:
    // alternatif, depo çökünce herkese 429 vermek. Uçların kendisi zaten depo
    // yokken önbelleksiz çalışıyor, yani kötüye kullanım kazancı da sıfıra iniyor.
    sayacArtir: (a, p) => yut(() => depo.sayacArtir(a, p), 0),
    saglikli: () => yut(() => depo.saglikli(), false),
    kapat: () => yut(() => depo.kapat(), undefined as void)
  }
}
