import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { handleMesaj, eskiDepoyuTemizle } from '../src/sw'

const ilan: any = {
  ilanId: '1', url: '/ilan/1', baslik: 'Fiat Egea', fiyat: { tutar: 800000, paraBirimi: 'TL' },
  kategori: 'Otomobil', marka: 'Fiat', seri: 'Egea', model: '1.6', yil: 2019, km: 100000,
  yakit: 'Dizel', vites: 'Manuel', agirHasarKayitli: 'Hayır', kimden: 'Sahibinden',
  il: 'İzmir', ilce: 'Bornova', aciklamaText: 'Temiz araç. Tel 0532 111 22 33',
  modelAramaPath: '/fiat-egea', ustAramaPath: null, ekAlanlar: {}
}
const istek = (): any => ({ tip: 'analyze', istek: { ilan: JSON.parse(JSON.stringify(ilan)), benzerFiyatlar: [] } })

const AI_CEVAP = {
  skor: 7, durumEtiketi: 'Makul', chipler: ['Dizel'], bayraklar: [],
  avantajlar: ['a'], dezavantajlar: ['b'], ozet: 'özet', pazarlikHedefi: 700000, fiyatYorumu: 'yorum'
}
const geminiYanit = (metin: string) => ({
  ok: true, status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: metin }] }, finishReason: 'STOP' }] }),
  text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: metin }] } }] })
})

function depoKur(baslangic: Record<string, any> = {}) {
  const kutu = { ...baslangic }
  ;(globalThis as any).chrome = {
    storage: { local: {
      get: async (k: string | null) => (k === null ? kutu : { [k]: kutu[k] }),
      set: async (o: Record<string, any>) => { Object.assign(kutu, o) },
      remove: async (ks: string | string[]) => { for (const k of ([] as string[]).concat(ks)) delete kutu[k] }
    } },
    runtime: {}
  }
  return kutu
}

afterEach(() => { delete (globalThis as any).chrome })

describe('analiz tamamen tarayıcıda', () => {
  it('anahtar yoksa hiç ağa çıkmaz, kurulum çağrısı döner', async () => {
    depoKur()
    let cagrildi = false
    const fetcher: any = async () => { cagrildi = true }
    expect(await handleMesaj(istek(), fetcher)).toEqual({ ok: false, hata: 'anahtarYok' })
    expect(cagrildi).toBe(false)
  })

  it('istek GOOGLE’a gider — bizim sunucumuza değil', async () => {
    depoKur({ geminiAnahtar: 'AIzaSyTest' })
    const cagrilar: any[] = []
    const fetcher: any = async (url: string, init: any) => {
      cagrilar.push({ url, init }); return geminiYanit(JSON.stringify(AI_CEVAP))
    }
    const c = await handleMesaj(istek(), fetcher)
    expect(c.ok).toBe(true)
    expect(cagrilar).toHaveLength(1)
    expect(cagrilar[0].url).toContain('generativelanguage.googleapis.com')
    expect(cagrilar[0].url).not.toContain('railway')
    // Anahtar başlıkta gider; gövdede ya da URL'de sızmaz
    expect(cagrilar[0].init.headers['x-goog-api-key']).toBe('AIzaSyTest')
    expect(cagrilar[0].url).not.toContain('AIzaSyTest')
    expect(cagrilar[0].init.body).not.toContain('AIzaSyTest')
  })

  it('PII maskesi çağrıdan ÖNCE uygulanır — telefon Google’a gitmez', async () => {
    depoKur({ geminiAnahtar: 'AIzaSyTest' })
    let govde = ''
    const fetcher: any = async (_u: string, init: any) => {
      govde = init.body; return geminiYanit(JSON.stringify(AI_CEVAP))
    }
    await handleMesaj(istek(), fetcher)
    expect(govde).not.toContain('0532 111 22 33')
    expect(govde).toContain('[telefon]')
  })

  it('deterministik katmanlar tarayıcıda hesaplanır', async () => {
    depoKur({ geminiAnahtar: 'AIzaSyTest' })
    const fetcher: any = async () => geminiYanit(JSON.stringify(AI_CEVAP))
    const c: any = await handleMesaj(
      { tip: 'analyze', istek: { ilan: JSON.parse(JSON.stringify(ilan)), benzerFiyatlar: [700000, 750000, 800000, 850000, 900000] } } as any,
      fetcher
    )
    expect(c.ok).toBe(true)
    expect(c.veri.fiyatIstatistik).not.toBe(null)      // 5 örnek → istatistik çıkar
    expect(c.veri.kmDurum).not.toBe(null)
    expect(c.veri.kronikSorunlar).toEqual([])          // profil katmanı sunucudaydı
  })

  it('hata türleri ayrı kodlara eşlenir — kullanıcı ne yapacağını bilsin', async () => {
    depoKur({ geminiAnahtar: 'AIzaSyTest' })
    const ile = (govde: string, status = 200): any => async () =>
      status === 200 ? geminiYanit(govde) : { ok: false, status, text: async () => govde }

    expect(await handleMesaj(istek(), ile('{"error":{"message":"billing"}}', 429)))
      .toEqual({ ok: false, hata: 'anahtarSorunu' })
    expect(await handleMesaj(istek(), ile('{"error":{"message":"rate limit"}}', 429)))
      .toEqual({ ok: false, hata: 'hizLimiti' })
    // JSON hiç ayrıştırılamazsa analiz üretilemedi
    expect(await handleMesaj(istek(), ile('bu json değil'))).toEqual({ ok: false, hata: 'ai' })
  })
})

describe('liste skorları anahtarsız çalışır', () => {
  it('AI yok, ağ yok, anahtar gerekmiyor', async () => {
    depoKur()
    let cagrildi = false
    const fetcher: any = async () => { cagrildi = true }
    const c: any = await handleMesaj({
      tip: 'batchScore',
      istek: {
        satirlar: [{ ilanId: '1', url: null, marka: 'Fiat', seri: 'Egea', model: '1.6', baslik: 'x', yil: 2019, km: 100000, fiyat: { tutar: 800000, paraBirimi: 'TL' }, il: 'İzmir' }],
        sayfaFiyatlari: [700000, 800000, 900000]
      }
    } as any, fetcher)
    expect(c.ok).toBe(true)
    expect(c.veri.sonuclar).toHaveLength(1)
    expect(cagrildi).toBe(false)
  })
})

describe('eski depo temizliği', () => {
  it('çekim artıkları ve artık kullanılmayan oturum/cihaz kaydı silinir', async () => {
    const kutu = depoKur({
      'benzer:/fiat-egea:2020': { x: 1 }, benzerIstekler: [1],
      supabaseOturum: { access_token: 't' }, cihazId: 'c-1',
      geminiAnahtar: 'AIzaSyKalmali', listeDepo: { '/x': {} }
    })
    await eskiDepoyuTemizle()
    expect(Object.keys(kutu).sort()).toEqual(['geminiAnahtar', 'listeDepo'])
  })
})

describe('paylaşılan önbellek', () => {
  const PAYLASILAN = {
    skor: 4.2, durumEtiketi: 'Dikkatli Ol', chipler: ['Dizel'], bayraklar: [{ tip: 'sari', metin: 'Tramer yok' }],
    avantajlar: ['başkasının yazdığı artı'], dezavantajlar: ['eksi'],
    ozet: 'paylaşılan özet', fiyatYorumu: 'paylaşılan fiyat yorumu'
  }
  const istekIst = (): any => ({
    tip: 'analyze',
    istek: {
      ilan: JSON.parse(JSON.stringify(ilan)),
      benzerFiyatlar: [700000, 750000, 800000, 850000, 900000],
      siteAd: 'sahibinden'
    }
  })
  // Sahte istemci: sw'nin paylaşım katmanını izin/derleme sabitinden bağımsız sınar.
  const sahteIstemci = (kayit: any) => {
    const yazilan: any[] = []
    const istemci = {
      oku: async (a: string) => { istemci.okunan.push(a); return kayit },
      yaz: async (a: string, analiz: any) => { yazilan.push({ anahtar: a, analiz }); return 'yazildi' as const },
      okunan: [] as string[],
      yazilan
    }
    return istemci
  }

  it('KAPALIYKEN sunucumuza hiç istek gitmez — akış bugünküyle aynı', async () => {
    depoKur({ geminiAnahtar: 'AIzaSyTest' })
    const cagrilar: string[] = []
    const fetcher: any = async (url: string) => { cagrilar.push(url); return geminiYanit(JSON.stringify(AI_CEVAP)) }
    const c: any = await handleMesaj(istekIst(), fetcher) // paylasimKur varsayılanı: ayar yok → null
    expect(c.ok).toBe(true)
    expect(cagrilar).toHaveLength(1)
    expect(cagrilar[0]).toContain('generativelanguage.googleapis.com')
  })

  it('ANAHTAR YOKSA önbelleğe hiç bakılmaz — katılım karşılıklı', async () => {
    // Kendi anahtarıyla üretip paylaşmayan biri başkalarının ürettiğini de görmemeli,
    // yoksa herkesin beklediği ve kimsenin doldurmadığı bir önbellek olur.
    depoKur()
    const istemci = sahteIstemci({ analiz: PAYLASILAN, ts: Date.now() })
    const c = await handleMesaj(istekIst(), (async () => { throw new Error('ağ') }) as any, async () => istemci)
    expect(c).toEqual({ ok: false, hata: 'anahtarYok' })
    expect(istemci.okunan).toHaveLength(0)
  })

  it('İSABET: Gemini HİÇ çağrılmaz, sonuç paylaşılan metinden gelir', async () => {
    depoKur({ geminiAnahtar: 'AIzaSyTest' })
    const cagrilar: string[] = []
    const fetcher: any = async (url: string) => { cagrilar.push(url); return geminiYanit(JSON.stringify(AI_CEVAP)) }
    const istemci = sahteIstemci({ analiz: PAYLASILAN, ts: 1700000000000 })

    const c: any = await handleMesaj(istekIst(), fetcher, async () => istemci)
    expect(c.ok).toBe(true)
    expect(cagrilar).toHaveLength(0)                    // kullanıcının anahtarı harcanmadı
    expect(c.veri.ozet).toBe('paylaşılan özet')
    expect(c.kaynak).toBe('paylasilan')
    expect(c.paylasimTs).toBe(1700000000000)
    expect(istemci.okunan[0]).toMatch(/^[0-9a-f]{64}$/)
    expect(istemci.yazilan).toHaveLength(0)             // zaten orada, geri yazma yok
  })

  it('İSABETTE SAYILAR YERELDEN gelir — zehirlenen kayıt rakamlara ulaşamaz', async () => {
    depoKur({ geminiAnahtar: 'AIzaSyTest' })
    // Kayda sayı alanları da sokulmaya çalışılıyor: birleştirme bunları YOK SAYMALI.
    const zehirli = { ...PAYLASILAN, fiyatIstatistik: { medyan: 1, p25: 1, p75: 1, n: 99, yuzdelik: 0 }, pazarlikHedefi: 1 }
    const istemci = sahteIstemci({ analiz: zehirli, ts: Date.now() })
    const c: any = await handleMesaj(istekIst(), (async () => { throw new Error('ağ') }) as any, async () => istemci)
    expect(c.ok).toBe(true)
    expect(c.veri.fiyatIstatistik.medyan).toBe(800000)  // yerel örneklemin medyanı
    expect(c.veri.fiyatIstatistik.n).toBe(5)
    expect(c.veri.kmDurum).not.toBeNull()
    expect(c.veri.pazarlikHedefi).toBe(760000)          // pazarlıkTabanı(800000, 800000) = 760000
    expect(c.veri.ozet).toBe('paylaşılan özet')         // metin paylaşılandan
  })

  it('İSABETSİZLİK: kendi anahtarıyla üretilir ve YALNIZ METİN paylaşılır', async () => {
    depoKur({ geminiAnahtar: 'AIzaSyTest' })
    const fetcher: any = async () => geminiYanit(JSON.stringify(AI_CEVAP))
    const istemci = sahteIstemci(null)

    const c: any = await handleMesaj(istekIst(), fetcher, async () => istemci)
    expect(c.ok).toBe(true)
    expect(c.kaynak).toBe('kendi')
    // Açık yenileme DEĞİL: paylaşım durumu taşınmaz, panelde gürültü olurdu.
    expect(c.paylasimDurum).toBeUndefined()
    expect(istemci.yazilan).toHaveLength(1)
    expect(istemci.yazilan[0].anahtar).toBe(istemci.okunan[0]) // okunan ve yazılan anahtar AYNI
    // Sayılar sunucuya gitmiyor: kötü niyetli bir kayıt bunlara hiç sahip olamamalı.
    expect(istemci.yazilan[0].analiz.fiyatIstatistik).toBeUndefined()
    expect(istemci.yazilan[0].analiz.kmDurum).toBeUndefined()
    expect(istemci.yazilan[0].analiz.pazarlikHedefi).toBeUndefined()
    expect(istemci.yazilan[0].analiz.ozet).toBe('özet')
  })

  it('örneklemi olan ile olmayan AYRI anahtar kullanır', async () => {
    depoKur({ geminiAnahtar: 'AIzaSyTest' })
    const fetcher: any = async () => geminiYanit(JSON.stringify(AI_CEVAP))
    const ileIst = sahteIstemci(null)
    const istsiz = sahteIstemci(null)
    await handleMesaj(istekIst(), fetcher, async () => ileIst)
    await handleMesaj(istek(), fetcher, async () => istsiz) // benzerFiyatlar boş → istatistik yok
    expect(ileIst.okunan[0]).not.toBe(istsiz.okunan[0])
  })

  it('AI hatasında paylaşım yapılmaz', async () => {
    depoKur({ geminiAnahtar: 'AIzaSyTest' })
    const istemci = sahteIstemci(null)
    const fetcher: any = async () => ({ ok: false, status: 429, text: async () => '{"error":{"message":"rate limit"}}' })
    const c = await handleMesaj(istekIst(), fetcher, async () => istemci)
    expect(c).toEqual({ ok: false, hata: 'hizLimiti' })
    expect(istemci.yazilan).toHaveLength(0)
  })
})

describe('zorla yenileme', () => {
  const PAYLASILAN = {
    skor: 4.2, durumEtiketi: 'Dikkatli Ol', chipler: [], bayraklar: [],
    avantajlar: ['x'], dezavantajlar: ['y'], ozet: 'paylaşılan özet', fiyatYorumu: ''
  }
  const zorlaIstek = (): any => ({
    tip: 'analyze',
    istek: { ilan: JSON.parse(JSON.stringify(ilan)), benzerFiyatlar: [], siteAd: 'sahibinden', zorla: true }
  })

  it('önbellekte kayıt VARKEN bile okumaz, kendi anahtarıyla üretir', async () => {
    depoKur({ geminiAnahtar: 'AIzaSyTest' })
    const okunan: string[] = []
    const yazilan: any[] = []
    const istemci = {
      oku: async (a: string) => { okunan.push(a); return { analiz: PAYLASILAN, ts: Date.now() } },
      yaz: async (a: string, analiz: any) => { yazilan.push({ anahtar: a, analiz }); return 'vardi' as const }
    }
    const c: any = await handleMesaj(zorlaIstek(), (async () => geminiYanit(JSON.stringify(AI_CEVAP))) as any, async () => istemci)
    expect(c.ok).toBe(true)
    expect(okunan).toHaveLength(0)          // okuma atlandı
    expect(c.kaynak).toBe('kendi')
    expect(c.veri.ozet).toBe('özet')        // paylaşılan değil, taze analiz
  })

  it('sonucu YİNE paylaşıma yazar — itiraz sinyalini üreten şey bu', async () => {
    // Yazmasaydı sunucu skorları karşılaştıramaz ve zehirli kayıt hiç işaretlenmezdi.
    depoKur({ geminiAnahtar: 'AIzaSyTest' })
    const yazilan: any[] = []
    const istemci = {
      oku: async () => ({ analiz: PAYLASILAN, ts: Date.now() }),
      yaz: async (a: string, analiz: any) => { yazilan.push({ anahtar: a, analiz }); return 'itiraz' as const }
    }
    const c: any = await handleMesaj(zorlaIstek(), (async () => geminiYanit(JSON.stringify(AI_CEVAP))) as any, async () => istemci)
    expect(yazilan).toHaveLength(1)
    // Sunucunun kararı panele taşınmalı: yenileme sessiz bir hiçlik gibi görünmesin.
    expect(c.paylasimDurum).toBe('itiraz')
    expect(yazilan[0].anahtar).toMatch(/^[0-9a-f]{64}$/)
    expect(yazilan[0].analiz.skor).toBe(AI_CEVAP.skor)
  })
})
