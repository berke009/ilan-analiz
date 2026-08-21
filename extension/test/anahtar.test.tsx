import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  anahtarGetir, anahtarKaydet, anahtarSil, anahtarDogrula, anahtarMaskele, VARSAYILAN_MODEL
} from '../src/anahtar'

const yanit = (status: number): any => ({ ok: status >= 200 && status < 300, status })

describe('anahtar saklama', () => {
  let kutu: Record<string, any>
  beforeEach(() => {
    kutu = {}
    ;(globalThis as any).chrome = {
      storage: { local: {
        get: async (k: string) => ({ [k]: kutu[k] }),
        set: async (o: Record<string, any>) => { Object.assign(kutu, o) },
        remove: async (k: string) => { delete kutu[k] }
      } }
    }
  })
  afterEach(() => { delete (globalThis as any).chrome })

  it('kaydedilen anahtar geri okunur, baştaki/sondaki boşluk kırpılır', async () => {
    await anahtarKaydet('  AIzaSyTestAnahtar123  ')
    expect(await anahtarGetir()).toBe('AIzaSyTestAnahtar123')
  })

  it('anahtar yokken null döner', async () => {
    expect(await anahtarGetir()).toBe(null)
  })

  it('silinince gerçekten gider', async () => {
    await anahtarKaydet('AIzaSyTest')
    await anahtarSil()
    expect(await anahtarGetir()).toBe(null)
  })
})

describe('anahtar doğrulama', () => {
  it('geçerli anahtar: TEK MODEL sorgusu yapılır, token harcanmaz', async () => {
    const cagrilar: any[] = []
    const fetcher: any = async (url: string, init: any) => { cagrilar.push({ url, init }); return yanit(200) }
    expect(await anahtarDogrula('AIzaSyGecerli', fetcher)).toEqual({ ok: true })
    expect(cagrilar).toHaveLength(1)
    // generateContent DEĞİL: o token yakar ve kullanıcıya boşuna para harcatır
    expect(cagrilar[0].url).toContain(`/models/${VARSAYILAN_MODEL}`)
    expect(cagrilar[0].url).not.toContain('generateContent')
    expect(cagrilar[0].init.headers['x-goog-api-key']).toBe('AIzaSyGecerli')
  })

  it('boş anahtar ağa hiç çıkmaz', async () => {
    let cagrildi = false
    const fetcher: any = async () => { cagrildi = true; return yanit(200) }
    expect(await anahtarDogrula('   ', fetcher)).toEqual({ ok: false, hata: 'bos' })
    expect(cagrildi).toBe(false)
  })

  it('HTTP durumları ayrı hatalara eşlenir', async () => {
    const ile = (s: number): any => async () => yanit(s)
    expect(await anahtarDogrula('k', ile(400))).toEqual({ ok: false, hata: 'gecersiz' })
    expect(await anahtarDogrula('k', ile(403))).toEqual({ ok: false, hata: 'yetki' })
    expect(await anahtarDogrula('k', ile(429))).toEqual({ ok: false, hata: 'kota' })
  })

  it('ağ hatası kota/geçersizden ayrı tutulur — teşhis için şart', async () => {
    const fetcher: any = async () => { throw new Error('offline') }
    expect(await anahtarDogrula('k', fetcher)).toEqual({ ok: false, hata: 'ag' })
  })
})

describe('anahtar maskeleme', () => {
  it('uzun anahtarda baş ve son görünür, ortası gizlenir', () => {
    const m = anahtarMaskele('AIzaSyABCDEFGHIJKLMNOP1234')
    expect(m.startsWith('AIzaSy')).toBe(true)
    expect(m.endsWith('1234')).toBe(true)
    expect(m).not.toContain('ABCDEFGHIJ')
  })
  it('kısa girdide hiçbir karakter sızmaz', () => {
    expect(anahtarMaskele('kisa')).toBe('••••')
  })
})

// Popup arayüzü: kullanıcının gördüğü akış. Anahtar geçersizse KAYDEDİLMEMELİ —
// yoksa hata ilan sayfasında çıkar ve kullanıcı sebebini orada aramaya başlar.
describe('Anahtar arayüzü', () => {
  let kutu: Record<string, any>
  beforeEach(() => {
    kutu = {}
    ;(globalThis as any).chrome = {
      storage: { local: {
        get: async (k: string) => ({ [k]: kutu[k] }),
        set: async (o: Record<string, any>) => { Object.assign(kutu, o) },
        remove: async (k: string) => { delete kutu[k] }
      } }
    }
  })
  afterEach(() => { delete (globalThis as any).chrome; delete (globalThis as any).fetch })

  // Preact'in async render'ı sabit setTimeout ile bazen yetişmiyordu (test kâh geçip
  // kâh kalıyordu). Koşul sağlanana kadar bekle — deterministik.
  const bekle = () => new Promise(r => setTimeout(r, 0))
  async function bekleKadar(kosul: () => boolean, ad = 'koşul') {
    for (let i = 0; i < 50; i++) { if (kosul()) return; await bekle() }
    throw new Error(`bekleKadar: ${ad} 50 turda sağlanmadı`)
  }

  it('anahtar yokken form çıkar, kayıtlıyken maskeli görünür', async () => {
    const { render } = await import('preact')
    const { Anahtar } = await import('../src/ui/Anahtar')
    const kok = document.createElement('div')

    render(<Anahtar />, kok)
    await bekleKadar(() => !!kok.querySelector('#anahtar'), 'form göründü')
    expect(kok.textContent).toContain('kendi Google Gemini anahtarınla')

    kutu['geminiAnahtar'] = 'AIzaSyABCDEFGHIJKLMNOP1234'
    const kok2 = document.createElement('div')
    render(<Anahtar />, kok2)
    await bekleKadar(() => (kok2.textContent ?? '').includes('AIzaSy'), 'kayıtlı ekran')
    expect(kok2.querySelector('#anahtar')).toBe(null)
    expect(kok2.textContent).toContain('AIzaSy')
    expect(kok2.textContent).not.toContain('ABCDEFGHIJ')  // ortası gizli
  })

  it('geçersiz anahtar KAYDEDİLMEZ, hata gösterilir', async () => {
    ;(globalThis as any).fetch = async () => ({ ok: false, status: 400 })
    const { render } = await import('preact')
    const { Anahtar } = await import('../src/ui/Anahtar')
    const kok = document.createElement('div')
    render(<Anahtar />, kok)
    await bekleKadar(() => !!kok.querySelector('#anahtar'), 'form')

    ;(kok.querySelector('#anahtar') as HTMLInputElement).value = 'AIzaSyBozuk'
    kok.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await bekleKadar(() => (kok.textContent ?? '').includes('geçerli değil'), 'hata mesajı')
    expect(kutu['geminiAnahtar']).toBeUndefined()
  })

  it('geçerli anahtar kaydedilir ve ekran hazır durumuna geçer', async () => {
    ;(globalThis as any).fetch = async () => ({ ok: true, status: 200 })
    const { render } = await import('preact')
    const { Anahtar } = await import('../src/ui/Anahtar')
    const kok = document.createElement('div')
    render(<Anahtar />, kok)
    await bekleKadar(() => !!kok.querySelector('#anahtar'), 'form')

    ;(kok.querySelector('#anahtar') as HTMLInputElement).value = 'AIzaSyGecerliAnahtar12345'
    kok.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await bekleKadar(() => (kok.textContent ?? '').includes('Hazır'), 'hazır ekranı')
    expect(kutu['geminiAnahtar']).toBe('AIzaSyGecerliAnahtar12345')
  })
})

// Kurulum ekranındaki paylaşım onayı. Kutu ÖNCEDEN İŞARETLİ geliyor; bu testler
// işaretin gerçekten bir şey yaptığını, kaldırılınca hiçbir şey yapmadığını ve
// hiçbir hâlde anahtarı kaybetmediğini sabitliyor.
describe('kurulumda paylaşım onayı', () => {
  const KOK = 'https://onbellek.ornek.test'
  let kutu: Record<string, any>
  let istenen: string[]
  let izinVerilecek: boolean
  let istekPatlasin: boolean

  beforeEach(() => {
    kutu = {}
    istenen = []
    izinVerilecek = true
    istekPatlasin = false
    const izinler = new Set<string>()
    ;(globalThis as any).chrome = {
      storage: { local: {
        get: async (k: string) => ({ [k]: kutu[k] }),
        set: async (o: Record<string, any>) => { Object.assign(kutu, o) },
        remove: async (k: string) => { delete kutu[k] }
      } },
      permissions: {
        contains: async ({ origins }: any) => origins.every((o: string) => izinler.has(o)),
        request: async ({ origins }: any) => {
          // Chrome, jest hakkı düşmüşse istisna fırlatıyor — o yolu da kurabilelim.
          if (istekPatlasin) throw new Error('This function must be called during a user gesture')
          istenen.push(...origins)
          if (izinVerilecek) origins.forEach((o: string) => izinler.add(o))
          return izinVerilecek
        },
        remove: async ({ origins }: any) => { origins.forEach((o: string) => izinler.delete(o)); return true }
      }
    }
    ;(globalThis as any).fetch = async () => ({ ok: true, status: 200 })
    // PAYLASIM_KOK derleme sabiti; testte global olarak veriliyor ve modüller
    // sıfırlanıyor ki sabit yeniden hesaplansın.
    vi.stubGlobal('__PAYLASIM_KOK__', KOK)
    vi.resetModules()
  })
  afterEach(() => {
    delete (globalThis as any).chrome
    delete (globalThis as any).fetch
    vi.unstubAllGlobals()
  })

  const bekle = () => new Promise(r => setTimeout(r, 0))
  async function bekleKadar(kosul: () => boolean, ad = 'koşul') {
    for (let i = 0; i < 50; i++) { if (kosul()) return; await bekle() }
    throw new Error(`bekleKadar: ${ad} 50 turda sağlanmadı`)
  }

  async function formCiz() {
    const { render } = await import('preact')
    const { Anahtar } = await import('../src/ui/Anahtar')
    const kok = document.createElement('div')
    render(<Anahtar />, kok)
    await bekleKadar(() => !!kok.querySelector('#anahtar'), 'form')
    return kok
  }

  function gonder(kok: HTMLElement, anahtar = 'AIzaSyGecerliAnahtar12345') {
    ;(kok.querySelector('#anahtar') as HTMLInputElement).value = anahtar
    kok.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }

  it('kutu ÖNCEDEN İŞARETLİ gelir', async () => {
    const kok = await formCiz()
    const onay = kok.querySelector('#paylasimKatil') as HTMLInputElement
    expect(onay).not.toBe(null)
    expect(onay.checked).toBe(true)
    // Metin iki yönü de söylemeli: yalnız "hız kazan" demek karşılıklılığı gizlerdi.
    expect(kok.textContent).toContain('senin analizlerinin metni de paylaşılır')
  })

  it('işaretli bırakılırsa anahtar kaydedilir VE izin istenir', async () => {
    const kok = await formCiz()
    gonder(kok)
    await bekleKadar(() => (kok.textContent ?? '').includes('Hazır'), 'hazır ekranı')
    expect(kutu['geminiAnahtar']).toBe('AIzaSyGecerliAnahtar12345')
    expect(istenen).toEqual([`${KOK}/*`])
    expect(kutu['paylasimAcik']).toBe(true)
    // İzin alındı: yarım kalma bayrağı temizlenmiş olmalı, yoksa popup bir daha
    // açıldığında zaten tamamlanmış bir adımı tekrar isterdi.
    expect(kutu['paylasimIstek']).toBeUndefined()
  })

  it('işaret kaldırılırsa HİÇBİR izin istenmez ve niyet yazılmaz', async () => {
    const kok = await formCiz()
    ;(kok.querySelector('#paylasimKatil') as HTMLInputElement).checked = false
    gonder(kok)
    await bekleKadar(() => (kok.textContent ?? '').includes('Hazır'), 'hazır ekranı')
    expect(kutu['geminiAnahtar']).toBe('AIzaSyGecerliAnahtar12345')
    expect(istenen).toEqual([])
    expect(kutu['paylasimAcik']).toBeUndefined()
    expect(kutu['paylasimIstek']).toBeUndefined()
  })

  it('izin reddedilse bile anahtar kaydedilir ve paylaşım kapalı kalır', async () => {
    izinVerilecek = false
    const kok = await formCiz()
    gonder(kok)
    await bekleKadar(() => (kok.textContent ?? '').includes('Hazır'), 'hazır ekranı')
    expect(kutu['geminiAnahtar']).toBe('AIzaSyGecerliAnahtar12345')
    expect(kutu['paylasimAcik']).toBe(false)
    // Reddi saklamak, aynı soruyu her açılışta tekrar sormak olurdu.
    expect(kutu['paylasimIstek']).toBeUndefined()
  })

  it('izin isteği jest hatasıyla patlarsa ANAHTAR KAYBOLMAZ, niyet saklanır', async () => {
    // Doğrulama bir ağ isteği; döndüğünde tıklamanın jest hakkı düşmüş olabiliyor.
    // O hâlde bile kurulumun asıl işi tamamlanmalı.
    istekPatlasin = true
    const kok = await formCiz()
    gonder(kok)
    await bekleKadar(() => (kok.textContent ?? '').includes('Hazır'), 'hazır ekranı')
    expect(kutu['geminiAnahtar']).toBe('AIzaSyGecerliAnahtar12345')
    expect(kutu['paylasimIstek']).toBe(true)
  })

  it('geçersiz anahtarda izin İSTENMEZ — ortada kurulum yok', async () => {
    ;(globalThis as any).fetch = async () => ({ ok: false, status: 400 })
    const kok = await formCiz()
    gonder(kok, 'AIzaSyBozuk')
    await bekleKadar(() => (kok.textContent ?? '').includes('geçerli değil'), 'hata')
    expect(istenen).toEqual([])
    expect(kutu['paylasimIstek']).toBeUndefined()
  })
})
