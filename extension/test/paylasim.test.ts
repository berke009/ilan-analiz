import { describe, it, expect, afterEach } from 'vitest'
import { paylasimAyari, paylasimAc, paylasimKapat, paylasimIstemcisi, izinVarMi, paylasimAcikMi } from '../src/paylasim'
import type { PaylasilanAnaliz } from 'shared'

const KOK = 'https://onbellek.ornek.test'
const ANAHTAR = 'a'.repeat(64)
const ANALIZ: PaylasilanAnaliz = {
  skor: 7, durumEtiketi: 'Makul', chipler: ['Dizel'], bayraklar: [],
  avantajlar: ['a'], dezavantajlar: ['b'], ozet: 'özet', fiyatYorumu: 'yorum'
}

// İzinler chrome.permissions üzerinden; depo chrome.storage.local üzerinden.
function ortamKur(baslangic: Record<string, any> = {}, izinli = false) {
  const kutu: Record<string, any> = { ...baslangic }
  const izinler = new Set<string>(izinli ? [`${KOK}/*`] : [])
  const istekler: { verilecek: boolean; cagrildi: string[] } = { verilecek: true, cagrildi: [] }
  ;(globalThis as any).chrome = {
    storage: { local: {
      get: async (k: string | null) => (k === null ? kutu : { [k]: kutu[k] }),
      set: async (o: Record<string, any>) => { Object.assign(kutu, o) },
      remove: async (ks: string | string[]) => { for (const k of ([] as string[]).concat(ks)) delete kutu[k] }
    } },
    permissions: {
      contains: async ({ origins }: any) => origins.every((o: string) => izinler.has(o)),
      request: async ({ origins }: any) => {
        istekler.cagrildi.push(...origins)
        if (istekler.verilecek) origins.forEach((o: string) => izinler.add(o))
        return istekler.verilecek
      },
      remove: async ({ origins }: any) => { origins.forEach((o: string) => izinler.delete(o)); return true }
    },
    runtime: {}
  }
  return { kutu, izinler, istekler }
}
afterEach(() => { delete (globalThis as any).chrome })

describe('üç katmanlı kapalılık', () => {
  // Katmanlardan biri atlansa öbürü tutmalı. Bu testler o üçünü tek tek söküyor.

  it('adres derlenmemişse ayar YOK — özellik pakette hiç bulunmuyor', async () => {
    ortamKur({ paylasimAcik: true }, true)
    expect(await paylasimAyari('')).toBeNull()
  })

  it('kullanıcı tercihi kapalıysa ayar YOK — izin verilmiş olsa bile', async () => {
    ortamKur({}, true)
    expect(await paylasimAyari(KOK)).toBeNull()
  })

  it('tarayıcı izni yoksa ayar YOK — tercih açık olsa bile', async () => {
    // Kullanıcı chrome://extensions üzerinden izni geri aldığında anında etkili olmalı;
    // kendi bayrağımıza güvenmek onu görmezden gelmek olurdu.
    ortamKur({ paylasimAcik: true }, false)
    expect(await paylasimAyari(KOK)).toBeNull()
  })

  it('üçü de varsa ayar üretilir ve kimlik atanır', async () => {
    const { kutu } = ortamKur({ paylasimAcik: true }, true)
    const ayar = await paylasimAyari(KOK)
    expect(ayar).not.toBeNull()
    expect(ayar!.kok).toBe(KOK)
    expect(ayar!.kimlik).toMatch(/^[0-9a-f-]{36}$/)
    expect(kutu.istemciKimlik).toBe(ayar!.kimlik)
  })

  it('kimlik kalıcı: ikinci çağrı yenisini üretmez', async () => {
    ortamKur({ paylasimAcik: true }, true)
    const a = await paylasimAyari(KOK)
    const b = await paylasimAyari(KOK)
    expect(a!.kimlik).toBe(b!.kimlik)
  })
})

describe('açma ve kapatma', () => {
  it('açmak izin ister ve tercihi kaydeder', async () => {
    const { kutu, istekler } = ortamKur()
    expect(await paylasimAc(KOK)).toBe(true)
    expect(istekler.cagrildi).toEqual([`${KOK}/*`])
    expect(kutu.paylasimAcik).toBe(true)
  })

  it('TERCİH İZİN DİYALOĞUNDAN ÖNCE yazılır — popup kapanırsa bile kaydedilmiş olur', async () => {
    // Chrome, permissions.request() diyaloğunu açtığında action popup'ını KAPATIYOR;
    // belge yok edilince await'ten sonraki satırlar hiç çalışmıyor. Tercihi sonra
    // yazan sürüm canlıda şunu üretti: izin verildi, bayrak yazılmadı, özellik
    // sessizce kapalı kaldı ve hiçbir istek çıkmadı.
    const { kutu } = ortamKur()
    let istekAninda: unknown
    ;(globalThis as any).chrome.permissions.request = async ({ origins }: any) => {
      istekAninda = kutu.paylasimAcik // popup burada ölebilir
      return true
    }
    await paylasimAc(KOK)
    expect(istekAninda).toBe(true)
  })

  it('popup izin diyaloğunda ölse bile ayar geçerli olur', async () => {
    const { kutu, izinler } = ortamKur()
    // Popup ölümü: request izni verir ama promise'i çözmez, sonraki satırlar çalışmaz.
    ;(globalThis as any).chrome.permissions.request = ({ origins }: any) => {
      origins.forEach((o: string) => izinler.add(o))
      return new Promise(() => {}) // hiç çözülmez
    }
    void paylasimAc(KOK)
    await new Promise(r => setTimeout(r, 0))
    expect(kutu.paylasimAcik).toBe(true)
    expect(await paylasimAyari(KOK)).not.toBeNull()
  })

  it('izin reddedilirse tercih GERİ ALINIR — yarım açık durum olmaz', async () => {
    // Tercih izinden önce yazıldığı için reddedilme hâlinde geri alınması gerekiyor.
    // Geri alınmasa bile izin kapısı geçilmezdi; bu, ikinci savunma.
    const { kutu, istekler } = ortamKur()
    istekler.verilecek = false
    expect(await paylasimAc(KOK)).toBe(false)
    expect(kutu.paylasimAcik).toBe(false)
    expect(await paylasimAyari(KOK)).toBeNull()
  })

  it('izin dışarıdan geri alınırsa tercih KENDİNİ ONARIR', async () => {
    // Arayüz ile gerçek davranış ayrışırsa kullanıcı "açık" gördüğü bir özelliğin
    // neden çalışmadığını anlayamaz.
    const { kutu, izinler } = ortamKur({ paylasimAcik: true }, true)
    expect(await paylasimAcikMi(KOK)).toBe(true)
    izinler.clear() // chrome://extensions üzerinden geri alındı
    expect(await paylasimAyari(KOK)).toBeNull()
    expect(kutu.paylasimAcik).toBe(false)
    expect(await paylasimAcikMi(KOK)).toBe(false)
  })

  it('paylasimAcikMi GERÇEK kapıya bakar, yalnız izne değil', async () => {
    // İzin var ama tercih yok: arayüz "Açık" göstermemeli, çünkü istek çıkmayacak.
    ortamKur({}, true)
    expect(await izinVarMi(KOK)).toBe(true)
    expect(await paylasimAcikMi(KOK)).toBe(false)
  })

  it('kapatmak İZNİ DE geri alır ve kimliği siler', async () => {
    // Yalnız bayrağı indirmek, uzantının adrese çıkma yetkisini ayakta bırakırdı:
    // kullanıcının "kapattım" dediği şeyi yarım kapatmak olurdu.
    const { kutu } = ortamKur({ paylasimAcik: true }, true)
    await paylasimAyari(KOK)
    await paylasimKapat(KOK)
    expect(kutu.paylasimAcik).toBe(false)
    expect(kutu.istemciKimlik).toBeUndefined()
    expect(await izinVarMi(KOK)).toBe(false)
    expect(await paylasimAyari(KOK)).toBeNull()
  })
})

describe('istemci', () => {
  const ayar = { kok: KOK, kimlik: '11111111-2222-4333-8444-555555555555' }
  const yanit = (durum: number, govde: unknown) => ({
    ok: durum < 400, status: durum, json: async () => govde
  })

  it('okuma kimlik başlığıyla gider, adres anahtarı taşır', async () => {
    const cagrilar: any[] = []
    const f: any = async (url: string, init: any) => {
      cagrilar.push({ url, init })
      return yanit(200, { analiz: ANALIZ, ts: 1700000000000 })
    }
    const r = await paylasimIstemcisi(ayar, f).oku(ANAHTAR)
    expect(r!.analiz).toEqual(ANALIZ)
    expect(cagrilar[0].url).toBe(`${KOK}/v1/onbellek/${ANAHTAR}`)
    expect(cagrilar[0].init.headers['x-istemci-kimlik']).toBe(ayar.kimlik)
  })

  it('404 isabetsizlik: null döner, hata fırlatmaz', async () => {
    const f: any = async () => yanit(404, { hata: 'yok' })
    expect(await paylasimIstemcisi(ayar, f).oku(ANAHTAR)).toBeNull()
  })

  it('429 limit de sessizce null — kullanıcı sunucunun limitini görmemeli', async () => {
    const f: any = async () => yanit(429, { hata: 'limit' })
    expect(await paylasimIstemcisi(ayar, f).oku(ANAHTAR)).toBeNull()
  })

  it('ŞEMAYA UYMAYAN yanıt yok sayılır', async () => {
    // Bu metin kullanıcının paneline basılacak; doğrulaması sunucuya bırakılamaz.
    const f: any = async () => yanit(200, { analiz: { skor: 'çok iyi' }, ts: 1 })
    expect(await paylasimIstemcisi(ayar, f).oku(ANAHTAR)).toBeNull()
  })

  it('ağ hatası kullanıcıya yansımaz', async () => {
    const f: any = async () => { throw new Error('ağ yok') }
    expect(await paylasimIstemcisi(ayar, f).oku(ANAHTAR)).toBeNull()
    await expect(paylasimIstemcisi(ayar, f).yaz(ANAHTAR, ANALIZ)).resolves.toBeUndefined()
  })

  it('yazma gövdesi anahtar + analizden ibaret', async () => {
    const cagrilar: any[] = []
    const f: any = async (url: string, init: any) => { cagrilar.push({ url, init }); return yanit(201, {}) }
    await paylasimIstemcisi(ayar, f).yaz(ANAHTAR, ANALIZ)
    expect(cagrilar[0].url).toBe(`${KOK}/v1/onbellek`)
    expect(cagrilar[0].init.method).toBe('POST')
    expect(JSON.parse(cagrilar[0].init.body)).toEqual({ anahtar: ANAHTAR, analiz: ANALIZ })
  })

  it('isteklerde zaman aşımı var — sunucu yavaşsa analiz beklemez', async () => {
    const cagrilar: any[] = []
    const f: any = async (_u: string, init: any) => { cagrilar.push(init); return yanit(404, {}) }
    await paylasimIstemcisi(ayar, f).oku(ANAHTAR)
    expect(cagrilar[0].signal).toBeInstanceOf(AbortSignal)
  })
})
