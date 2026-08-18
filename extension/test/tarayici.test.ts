import { describe, it, expect, afterEach } from 'vitest'
import { tarayici } from '../src/tarayici'

const g = globalThis as any
const eskiChrome = g.chrome
const eskiBrowser = g.browser
afterEach(() => { g.chrome = eskiChrome; g.browser = eskiBrowser })

describe('tarayıcı ad alanı seçimi', () => {
  it('Firefox: browser varsa o kullanılır (promise döndüren ad alanı)', async () => {
    // Firefox'ta chrome.* DE vardır ama callback tabanlıdır; await ile undefined verir.
    g.chrome = { storage: { local: { get: () => undefined } } }
    g.browser = { storage: { local: { get: async () => ({ a: 1 }) } } }
    expect(await tarayici.storage.local.get('a')).toEqual({ a: 1 })
  })

  it('Chrome: browser yoksa chrome kullanılır', async () => {
    g.browser = undefined
    g.chrome = { storage: { local: { get: async () => ({ b: 2 }) } } }
    expect(await tarayici.storage.local.get('b')).toEqual({ b: 2 })
  })

  it('tembel: modül yüklendikten SONRA kurulan ad alanını da görür', async () => {
    g.browser = undefined; g.chrome = undefined
    // bu noktada erişim undefined vermeli, çökmemeli
    expect(tarayici.storage).toBeUndefined()
    g.chrome = { storage: { local: { get: async () => ({ c: 3 }) } } }
    expect(await tarayici.storage.local.get('c')).toEqual({ c: 3 })
  })

  it('ikisi de yoksa erişim çökmez', () => {
    g.browser = undefined; g.chrome = undefined
    expect(() => tarayici.runtime).not.toThrow()
    expect(tarayici.runtime).toBeUndefined()
  })
})
