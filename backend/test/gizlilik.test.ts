import { describe, it, expect } from 'vitest'
import { makeApp } from '../src/index'

const app = makeApp()

describe('backend yalnız gizlilik sayfası sunar', () => {
  it('gizlilik politikası yayında', async () => {
    const r = await app.request('/gizlilik')
    expect(r.status).toBe(200)
    expect(await r.text()).toContain('Gizlilik')
  })

  it('sağlık ucu önbelleğe alınmaz', async () => {
    const r = await app.request('/health')
    expect(r.status).toBe(200)
    expect(r.headers.get('cache-control')).toContain('no-store')
  })

  // Analiz, kota, hesap ve ödeme uçları KALKTI. Yanlışlıkla geri gelirlerse sunucu
  // tekrar ilan içeriği görmeye başlar — ürünün tüm iddiası buna dayanıyor.
  it('kaldırılan uçlar gerçekten yok', async () => {
    const yollar: [string, string][] = [
      ['/api/analyze', 'POST'], ['/api/batch-score', 'POST'], ['/auth/ben', 'GET'],
      ['/stripe/webhook', 'POST'], ['/istatistik', 'GET'], ['/onaylandi', 'GET']
    ]
    for (const [yol, yontem] of yollar) {
      expect((await app.request(yol, { method: yontem })).status, yol).toBe(404)
    }
  })
})
