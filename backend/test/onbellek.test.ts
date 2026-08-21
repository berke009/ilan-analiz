import { describe, it, expect } from 'vitest'
import { makeApp } from '../src/index'
import { denetle } from '../src/onbellek'
import { ayarOku } from '../src/yapilandirma'
import { bellekDepo, toleransli, type Depo } from '../src/depo'
import type { PaylasilanAnaliz } from 'shared'

const ANALIZ: PaylasilanAnaliz = {
  skor: 7.2,
  durumEtiketi: 'Makul',
  chipler: ['Dizel', 'Otomatik', '2019'],
  bayraklar: [{ tip: 'sari', metin: 'Tramer bilgisi belirtilmemiş — satıcıya sorun' }],
  avantajlar: ['Yaşına göre düşük kilometre'],
  dezavantajlar: ['Açıklama kısa'],
  ozet: 'Fiyatı bandın ortasında, hasar beyanı temiz görünüyor.',
  fiyatYorumu: 'Benzer ilanların medyanına yakın.'
}
const ANAHTAR = 'a'.repeat(64)
const UZANTI = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop'

function kur(ek: Record<string, string> = {}, depo?: Depo) {
  const ayar = ayarOku({ PAYLASIM_ACIK: '1', ...ek } as NodeJS.ProcessEnv)
  return makeApp(ayar, depo ?? toleransli(bellekDepo()))
}
const yaz = (app: ReturnType<typeof kur>, govde: unknown, baslik: Record<string, string> = {}) =>
  app.request('/v1/onbellek', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...baslik },
    body: JSON.stringify(govde)
  })

describe('paylaşım kapalıyken sunucu bugünküyle aynı', () => {
  // Bu projenin duruşu: hiçbir şey ayarlamadan çalıştıran biri veri görmeyen bir
  // sunucu almalı. Rotalar 404 döndürmüyor, hiç kurulmuyor.
  const app = makeApp(ayarOku({} as NodeJS.ProcessEnv))

  it('önbellek uçları YOK', async () => {
    expect((await app.request(`/v1/onbellek/${ANAHTAR}`)).status).toBe(404)
    expect((await yaz(app, { anahtar: ANAHTAR, analiz: ANALIZ })).status).toBe(404)
  })

  it('gizlilik sayfası ve sağlık ucu çalışmaya devam eder', async () => {
    expect((await app.request('/gizlilik')).status).toBe(200)
    expect((await (await app.request('/health')).json()).paylasim).toBe(false)
  })
})

describe('yaz-oku turu', () => {
  it('yazılan kayıt aynı anahtarla okunur', async () => {
    const app = kur()
    const y = await yaz(app, { anahtar: ANAHTAR, analiz: ANALIZ })
    expect(y.status).toBe(201)
    expect(await y.json()).toEqual({ durum: 'yazildi' })

    const o = await app.request(`/v1/onbellek/${ANAHTAR}`)
    expect(o.status).toBe(200)
    const govde = await o.json()
    expect(govde.analiz).toEqual(ANALIZ)
    expect(govde.ts).toBeGreaterThan(0)
  })

  it('İLK YAZAN KAZANIR: ikinci yazma kaydı EZMEZ', async () => {
    // Zehirlenme savunmasının temeli. Bu kural düşerse kötü niyetli biri iyi bir
    // kaydın üstüne yazıp o ilanı açan herkese kendi metnini gösterebilir.
    const app = kur()
    await yaz(app, { anahtar: ANAHTAR, analiz: ANALIZ })
    const ikinci = await yaz(app, { anahtar: ANAHTAR, analiz: { ...ANALIZ, ozet: 'Hemen al, kaçmaz!' } })
    expect(ikinci.status).toBe(200)
    expect(await ikinci.json()).toEqual({ durum: 'vardi' })

    const govde = await (await app.request(`/v1/onbellek/${ANAHTAR}`)).json()
    expect(govde.analiz.ozet).toBe(ANALIZ.ozet)
  })

  it('isabetsizlik 404 ve önbelleğe ALINMAZ', async () => {
    const o = await kur().request(`/v1/onbellek/${'b'.repeat(64)}`)
    expect(o.status).toBe(404)
    // Kenarda tutulursa ilk kullanıcı yazdıktan sonra bile herkese boş dönerdi.
    expect(o.headers.get('cache-control')).toContain('no-store')
  })

  it('isabet kenarda önbelleklenebilir — kayıt TTL boyunca değişmez', async () => {
    const app = kur()
    await yaz(app, { anahtar: ANAHTAR, analiz: ANALIZ })
    expect((await app.request(`/v1/onbellek/${ANAHTAR}`)).headers.get('cache-control')).toContain('public')
  })

  it('bozuk anahtar biçimi 400', async () => {
    expect((await kur().request('/v1/onbellek/kisa')).status).toBe(400)
    expect((await kur().request(`/v1/onbellek/${'A'.repeat(64)}`)).status).toBe(400)
  })
})

describe('kayıt denetimi', () => {
  // Sunucunun sakladığı şey başka kullanıcıların paneline basılacak metin. Buraya
  // giren her cümle, hiç tanımadığı birine gösterilecek — denetim bu yüzden var.
  const red = async (analiz: PaylasilanAnaliz, sebep: string) => {
    const r = await yaz(kur(), { anahtar: ANAHTAR, analiz })
    expect(r.status).toBe(422)
    expect((await r.json()).hata).toBe(sebep)
  }

  it('telefon içeren metin reddedilir', () =>
    red({ ...ANALIZ, ozet: 'Detay için 0532 111 22 33 arayın.' }, 'pii'))

  it('IBAN içeren metin reddedilir', () =>
    red({ ...ANALIZ, avantajlar: ['Kapora TR33 0006 1005 1978 6457 8413 26'] }, 'pii'))

  it('alan adı/bağlantı içeren metin reddedilir — paylaşılan kutunun ilk kötüye kullanımı reklamdır', () =>
    red({ ...ANALIZ, ozet: 'Daha ucuzu ucuzarabam.com adresinde.' }, 'baglanti'))

  it('ham kontrol karakteri reddedilir', () =>
    red({ ...ANALIZ, fiyatYorumu: 'Makul\u0007fiyat' }, 'kontrol'))

  it('şema dışı gövde 400', async () => {
    expect((await yaz(kur(), { anahtar: ANAHTAR, analiz: { skor: 99 } })).status).toBe(400)
    expect((await yaz(kur(), { anahtar: 'kisa', analiz: ANALIZ })).status).toBe(400)
  })

  it('şema uzunluk tavanı: dev metin gövde limitine takılmadan da geçemez', async () => {
    const r = await yaz(kur(), { anahtar: ANAHTAR, analiz: { ...ANALIZ, ozet: 'a'.repeat(5000) } })
    expect(r.status).toBe(400)
  })

  it('bozuk JSON 400', async () => {
    const r = await kur().request('/v1/onbellek', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bozuk'
    })
    expect(r.status).toBe(400)
  })

  it('denetle temiz metne dokunmaz', () => {
    expect(denetle(ANALIZ)).toEqual({ ok: true })
  })
})

describe('kaynak denetimi', () => {
  it('uzantı kaynağı kabul edilir ve yankılanır', async () => {
    const r = await yaz(kur(), { anahtar: ANAHTAR, analiz: ANALIZ }, { origin: UZANTI })
    expect(r.status).toBe(201)
    expect(r.headers.get('access-control-allow-origin')).toBe(UZANTI)
  })

  it('Origin YOKSA kabul edilir — host_permissions ile gelen uzantı isteği CORS a tabi değil', async () => {
    expect((await yaz(kur(), { anahtar: ANAHTAR, analiz: ANALIZ })).status).toBe(201)
  })

  it('web sayfası kaynağı REDDEDİLİR', async () => {
    // Kullanıcıların tarayıcısı üzerinden yazma ucunu döven bir siteyi durduran engel.
    const r = await yaz(kur(), { anahtar: ANAHTAR, analiz: ANALIZ }, { origin: 'https://kotu.example' })
    expect(r.status).toBe(403)
  })

  it('IZINLI_ORIGIN ile açıkça izin verilen kaynak geçer', async () => {
    const app = kur({ IZINLI_ORIGIN: 'https://iyi.example' })
    const r = await yaz(app, { anahtar: ANAHTAR, analiz: ANALIZ }, { origin: 'https://iyi.example' })
    expect(r.status).toBe(201)
  })
})

describe('hız limiti', () => {
  it('yazma limiti aşılınca 429 ve Retry-After', async () => {
    const app = kur({ LIMIT_YAZMA_DK: '2' })
    const kimlik = { 'x-istemci-kimlik': '11111111-2222-4333-8444-555555555555' }
    for (let i = 0; i < 2; i++) {
      expect((await yaz(app, { anahtar: String(i).repeat(64), analiz: ANALIZ }, kimlik)).status).toBe(201)
    }
    const r = await yaz(app, { anahtar: '9'.repeat(64), analiz: ANALIZ }, kimlik)
    expect(r.status).toBe(429)
    expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0)
    expect((await r.json()).bekleSn).toBeGreaterThan(0)
  })

  it('okuma limiti yazmadan AYRI sayılır', async () => {
    // Aynı sayaca yazılırsa liste sayfasında gezinen kullanıcı kendi yazma hakkını
    // okuyarak tüketir ve hiçbir şey paylaşamaz hâle gelir.
    const app = kur({ LIMIT_YAZMA_DK: '1' })
    const kimlik = { 'x-istemci-kimlik': '11111111-2222-4333-8444-666666666666' }
    for (let i = 0; i < 5; i++) {
      expect((await app.request(`/v1/onbellek/${ANAHTAR}`, { headers: kimlik })).status).toBe(404)
    }
    expect((await yaz(app, { anahtar: ANAHTAR, analiz: ANALIZ }, kimlik)).status).toBe(201)
  })

  it('kimlikler birbirinin limitini tüketmez', async () => {
    const app = kur({ LIMIT_YAZMA_DK: '1' })
    const a = { 'x-istemci-kimlik': '11111111-2222-4333-8444-777777777777' }
    const b = { 'x-istemci-kimlik': '11111111-2222-4333-8444-888888888888' }
    expect((await yaz(app, { anahtar: '1'.repeat(64), analiz: ANALIZ }, a)).status).toBe(201)
    expect((await yaz(app, { anahtar: '2'.repeat(64), analiz: ANALIZ }, b)).status).toBe(201)
    expect((await yaz(app, { anahtar: '3'.repeat(64), analiz: ANALIZ }, a)).status).toBe(429)
  })

  it('kimliksiz istemciler IP sayacına düşer — kimliği atlamak limitten kaçış değil', async () => {
    const app = kur({ LIMIT_YAZMA_DK: '1', IP_BASLIGI: 'x-test-ip' })
    const ip = { 'x-test-ip': '203.0.113.9' }
    expect((await yaz(app, { anahtar: '1'.repeat(64), analiz: ANALIZ }, ip)).status).toBe(201)
    expect((await yaz(app, { anahtar: '2'.repeat(64), analiz: ANALIZ }, ip)).status).toBe(429)
  })
})

describe('depo arızası servisi düşürmez', () => {
  // Önbellek isabetsizliği kullanıcı için ürünün varsayılan davranışı: analiz kendi
  // anahtarıyla üretilir. Valkey arızasını 500 olarak kullanıcıya taşımak, olmayan
  // bir sorunu görünür kılmak olurdu.
  const bozukDepo = (): Depo => ({
    oku: async () => { throw new Error('bağlantı yok') },
    yazYoksa: async () => { throw new Error('bağlantı yok') },
    sayacArtir: async () => { throw new Error('bağlantı yok') },
    saglikli: async () => { throw new Error('bağlantı yok') },
    kapat: async () => {}
  })

  it('okuma 404 döner, 500 değil', async () => {
    const app = kur({}, toleransli(bozukDepo()))
    expect((await app.request(`/v1/onbellek/${ANAHTAR}`)).status).toBe(404)
  })

  it('yazma hata döndürmez', async () => {
    const app = kur({}, toleransli(bozukDepo()))
    expect((await yaz(app, { anahtar: ANAHTAR, analiz: ANALIZ })).status).toBeLessThan(400)
  })
})
