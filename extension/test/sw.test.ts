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
