import type { AiClient } from './analiz'

// Gemini native generateContent adaptörü. İstemcinin web_search aracını Gemini'nin
// dahili google_search grounding'ine çevirir — ayrı arama key'i gerekmez.
export function geminiClient(opts: { apiKey: string; baseUrl?: string; fetcher?: typeof fetch }): AiClient {
  const baseUrl = opts.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta'
  const fetcher = opts.fetcher ?? fetch
  return {
    messages: {
      async create(args: any) {
        const govde: Record<string, unknown> = {
          contents: (args.messages ?? []).map((m: any) => ({ role: 'user', parts: [{ text: m.content }] })),
          generationConfig: (() => {
            const gc: Record<string, unknown> = { maxOutputTokens: args.max_tokens }
            if (args.thinking?.type === 'disabled') gc.thinkingConfig = { thinkingBudget: 0 }
            return gc
          })()
        }
        if (args.tools?.some((t: any) => String(t.type ?? '').startsWith('web_search'))) {
          govde.tools = [{ google_search: {} }]
        }

        const gonder = (g: Record<string, unknown>) =>
          fetcher(`${baseUrl}/models/${args.model}:generateContent`, {
            method: 'POST',
            headers: { 'x-goog-api-key': opts.apiKey, 'content-type': 'application/json' },
            body: JSON.stringify(g)
          })

        let res = await gonder(govde)
        // thinkingConfig'i HER model kabul etmiyor: gemini-flash-lite-latest
        // thinkingBudget:0'a 400 INVALID_ARGUMENT veriyor (canlıda ölçüldü) ve o modelde
        // düşünme zaten varsayılan kapalı, yani alan hem gereksiz hem yasak. Düşünmeyi
        // kapatabilen modellerde ise gerekli. Model adı listesi tutmak yerine 400'de
        // alanı düşürüp bir kez daha deniyoruz.
        // 400 çıkarım ÖNCESİ döner, ücretsizdir.
        if (res.status === 400 && (govde.generationConfig as any)?.thinkingConfig) {
          const gc = { ...(govde.generationConfig as Record<string, unknown>) }
          delete gc.thinkingConfig
          res = await gonder({ ...govde, generationConfig: gc })
        }
        if (!res.ok) {
          // Boşluklar TEK satıra indirilir: sağlayıcı gövdesi JSON ve içindeki satır
          // sonları log satırını bölüyordu — canlıda mesaj '{' sonrası kayboluyor,
          // yani asıl sebep (RESOURCE_EXHAUSTED / INVALID_ARGUMENT) hiç görünmüyordu.
          const gövde = (await res.text()).replace(/\s+/g, ' ').slice(0, 300)
          throw new Error(`gemini HTTP ${res.status}: ${gövde}`)
        }
        const data: any = await res.json()
        const aday = data?.candidates?.[0]
        if (!aday) throw new Error(`gemini: yanıt boş — candidates yok: ${JSON.stringify(data).slice(0, 300)}`)
        const text = (aday.content?.parts ?? []).map((p: any) => p.text ?? '').join('')
        return {
          content: [{ type: 'text', text }],
          stop_reason: aday.finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn'
        }
      }
    }
  }
}
