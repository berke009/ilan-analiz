import { describe, it, expect } from 'vitest'
import { geminiClient } from '../src/gemini'

function fakeFetcher(status: number, gövde: unknown): { fetcher: typeof fetch; çağrılar: any[] } {
  const çağrılar: any[] = []
  const fetcher = (async (url: any, init: any) => {
    çağrılar.push({ url, init })
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => gövde,
      text: async () => JSON.stringify(gövde)
    } as any
  }) as typeof fetch
  return { fetcher, çağrılar }
}

const OK_GOVDE = { candidates: [{ content: { parts: [{ text: 'merhaba' }] }, finishReason: 'STOP' }] }

describe('geminiClient — istek dönüşümü', () => {
  it('doğru URL (model adı yolda), x-goog-api-key header, contents/parts yapısı', async () => {
    const { fetcher, çağrılar } = fakeFetcher(200, OK_GOVDE)
    const ai = geminiClient({ apiKey: 'gk-test', fetcher })
    await ai.messages.create({ model: 'gemini-2.5-flash', max_tokens: 100, messages: [{ role: 'user', content: 'selam' }] })

    expect(çağrılar.length).toBe(1)
    expect(çağrılar[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent')
    expect(çağrılar[0].init.headers['x-goog-api-key']).toBe('gk-test')
    expect(çağrılar[0].init.headers['content-type']).toBe('application/json')
    const gövde = JSON.parse(çağrılar[0].init.body)
    expect(gövde.contents).toEqual([{ role: 'user', parts: [{ text: 'selam' }] }])
    expect(gövde.generationConfig.maxOutputTokens).toBe(100)
  })

  it('birden fazla user mesajı sırayla parts a çevrilir', async () => {
    const { fetcher, çağrılar } = fakeFetcher(200, OK_GOVDE)
    const ai = geminiClient({ apiKey: 'k', fetcher })
    await ai.messages.create({
      model: 'm', max_tokens: 10,
      messages: [{ role: 'user', content: 'ilk' }, { role: 'user', content: 'ikinci' }]
    })
    const gövde = JSON.parse(çağrılar[0].init.body)
    expect(gövde.contents).toEqual([
      { role: 'user', parts: [{ text: 'ilk' }] },
      { role: 'user', parts: [{ text: 'ikinci' }] }
    ])
  })

  it("thinking:{type:'disabled'} → generationConfig.thinkingConfig.thinkingBudget === 0", async () => {
    const { fetcher, çağrılar } = fakeFetcher(200, OK_GOVDE)
    const ai = geminiClient({ apiKey: 'k', fetcher })
    await ai.messages.create({ model: 'm', max_tokens: 10, thinking: { type: 'disabled' }, messages: [{ role: 'user', content: 'a' }] })
    const gövde = JSON.parse(çağrılar[0].init.body)
    expect(gövde.generationConfig.thinkingConfig.thinkingBudget).toBe(0)
  })

  it("tools:[{type:'web_search_20250305'}] → gövdede tools:[{google_search:{}}]", async () => {
    const { fetcher, çağrılar } = fakeFetcher(200, OK_GOVDE)
    const ai = geminiClient({ apiKey: 'k', fetcher })
    await ai.messages.create({
      model: 'm', max_tokens: 10,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages: [{ role: 'user', content: 'a' }]
    })
    const gövde = JSON.parse(çağrılar[0].init.body)
    expect(gövde.tools).toEqual([{ google_search: {} }])
  })

  it('tools yoksa gövdede tools alanı yok', async () => {
    const { fetcher, çağrılar } = fakeFetcher(200, OK_GOVDE)
    const ai = geminiClient({ apiKey: 'k', fetcher })
    await ai.messages.create({ model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'a' }] })
    const gövde = JSON.parse(çağrılar[0].init.body)
    expect('tools' in gövde).toBe(false)
  })
})

describe('geminiClient — yanıt dönüşümü', () => {
  it('parts birleştirme + stop_reason end_turn', async () => {
    const { fetcher } = fakeFetcher(200, { candidates: [{ content: { parts: [{ text: 'me' }, { text: 'rhaba' }] }, finishReason: 'STOP' }] })
    const ai = geminiClient({ apiKey: 'k', fetcher })
    const resp = await ai.messages.create({ model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'a' }] })
    expect(resp).toEqual({ content: [{ type: 'text', text: 'merhaba' }], stop_reason: 'end_turn' })
  })

  it("finishReason MAX_TOKENS → stop_reason max_tokens", async () => {
    const { fetcher } = fakeFetcher(200, { candidates: [{ content: { parts: [{ text: 'kesik' }] }, finishReason: 'MAX_TOKENS' }] })
    const ai = geminiClient({ apiKey: 'k', fetcher })
    const resp = await ai.messages.create({ model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'a' }] })
    expect(resp.stop_reason).toBe('max_tokens')
  })

  it('boş candidates → hata fırlatır', async () => {
    const { fetcher } = fakeFetcher(200, { candidates: [] })
    const ai = geminiClient({ apiKey: 'k', fetcher })
    await expect(ai.messages.create({ model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'a' }] })).rejects.toThrow()
  })

  it('candidates alanı eksik → hata fırlatır', async () => {
    const { fetcher } = fakeFetcher(200, {})
    const ai = geminiClient({ apiKey: 'k', fetcher })
    await expect(ai.messages.create({ model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'a' }] })).rejects.toThrow()
  })
})

describe('geminiClient — HTTP hatası', () => {
  it('402 → hata fırlatır, mesaj status ve ham gövdeyi içerir', async () => {
    const { fetcher } = fakeFetcher(402, { error: { message: 'insufficient credit balance' } })
    const ai = geminiClient({ apiKey: 'k', fetcher })
    await expect(ai.messages.create({ model: 'm', max_tokens: 10, messages: [{ role: 'user', content: 'a' }] }))
      .rejects.toThrow(/gemini HTTP 402.*insufficient credit balance/)
  })
})

// Canlıda ölçüldü: gemini-flash-lite-latest thinkingBudget:0'a HTTP 400
// INVALID_ARGUMENT veriyor. O modelde düşünme zaten varsayılan kapalı, yani alan hem
// gereksiz hem yasak — ama düşünmeyi kapatabilen modellerde gerekli. Sonuç: profil
// katmanı (kronik sorunlar) her istekte düşüyordu.
describe('thinkingConfig merdiveni', () => {
  function ikiAsamaliFetcher(ilkStatus: number) {
    const cagrilar: any[] = []
    const fetcher = (async (url: any, init: any) => {
      cagrilar.push({ url, init })
      const ilk = cagrilar.length === 1
      const status = ilk ? ilkStatus : 200
      return {
        ok: status >= 200 && status < 300, status,
        json: async () => OK_GOVDE,
        text: async () => JSON.stringify(ilk ? { error: { message: 'Request contains an invalid argument.' } } : OK_GOVDE)
      } as any
    }) as typeof fetch
    return { fetcher, cagrilar }
  }

  it('400 alınca thinkingConfig düşürülüp yeniden denenir', async () => {
    const { fetcher, cagrilar } = ikiAsamaliFetcher(400)
    const ai = geminiClient({ apiKey: 'k', fetcher })
    const r = await ai.messages.create({
      model: 'gemini-flash-lite-latest', max_tokens: 2000,
      thinking: { type: 'disabled' }, messages: [{ role: 'user', content: 'x' }]
    })
    expect(cagrilar.length).toBe(2)
    const ilk = JSON.parse(cagrilar[0].init.body), ikinci = JSON.parse(cagrilar[1].init.body)
    expect(ilk.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 })
    expect(ikinci.generationConfig.thinkingConfig).toBeUndefined()
    expect(ikinci.generationConfig.maxOutputTokens).toBe(2000) // diğer ayarlar korunur
    expect((r.content[0] as any).text).toBe('merhaba')
  })

  it('thinkingConfig YOKKEN 400 tekrar denenmez — sonsuz döngü olmaz', async () => {
    const { fetcher, cagrilar } = ikiAsamaliFetcher(400)
    const ai = geminiClient({ apiKey: 'k', fetcher })
    await expect(ai.messages.create({
      model: 'm', max_tokens: 100, messages: [{ role: 'user', content: 'x' }]
    })).rejects.toThrow(/gemini HTTP 400/)
    expect(cagrilar.length).toBe(1)
  })

  it('429 (kota) tekrar denenmez — thinkingConfig suçlu değil', async () => {
    const { fetcher, cagrilar } = ikiAsamaliFetcher(429)
    const ai = geminiClient({ apiKey: 'k', fetcher })
    await expect(ai.messages.create({
      model: 'm', max_tokens: 100, thinking: { type: 'disabled' }, messages: [{ role: 'user', content: 'x' }]
    })).rejects.toThrow(/gemini HTTP 429/)
    expect(cagrilar.length).toBe(1)
  })
})
