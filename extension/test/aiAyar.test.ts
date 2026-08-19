import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { aiSaglayiciGetir, aiSaglayiciKaydet } from '../src/aiAyar'

describe('AI sağlayıcı tercihi', () => {
  let kutu: Record<string, unknown>
  const dunya = globalThis as unknown as { chrome?: typeof chrome }

  beforeEach(() => {
    kutu = {}
    dunya.chrome = {
      storage: {
        local: {
          get: async (anahtar: string) => ({ [anahtar]: kutu[anahtar] }),
          set: async (degerler: Record<string, unknown>) => { Object.assign(kutu, degerler) }
        }
      }
    } as unknown as typeof chrome
  })

  afterEach(() => { delete dunya.chrome })

  it('yeni kurulumda hiçbir veriyi dışarı çıkarmayan yerel motoru seçer', async () => {
    expect(await aiSaglayiciGetir()).toBe('yerel')
  })

  it('mevcut Gemini anahtarı olan kullanıcıyı habersizce yerel motora geçirmez', async () => {
    kutu.geminiAnahtar = 'AIzaSyMevcut'
    expect(await aiSaglayiciGetir()).toBe('gemini')
  })

  it('açık kullanıcı tercihi eski anahtarın önüne geçer', async () => {
    kutu.geminiAnahtar = 'AIzaSyMevcut'
    await aiSaglayiciKaydet('yerel')
    expect(await aiSaglayiciGetir()).toBe('yerel')
    expect(kutu.aiSaglayici).toBe('yerel')
  })
})
