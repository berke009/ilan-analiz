import { describe, expect, it, vi } from 'vitest'
import type { MLCEngineInterface } from '@mlc-ai/web-llm'
import { webLlmClient, YEREL_MODEL } from '../src/yerelAi'

type YerelIstek = {
  model: string
  max_tokens: number
  extra_body: { enable_thinking: boolean }
  response_format: { type: string; schema: string }
}

describe('WebLLM analiz adaptörü', () => {
  it('düşünmeyi kapatır, çıktıyı JSON şemasıyla sınırlar ve cevabı AiClient biçimine çevirir', async () => {
    const create = vi.fn(async (_istek: YerelIstek) => ({
      choices: [{ message: { content: '{"skor":7}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 4 }
    }))
    // Test dublörü yalnız adaptörün kullandığı chat.completions yüzeyini uygular.
    const motor = { chat: { completions: { create } } } as unknown as MLCEngineInterface

    const cevap = await webLlmClient(motor).messages.create({
      model: 'yok-sayilir', max_tokens: 6000,
      messages: [{ role: 'user', content: 'Yalnız JSON döndür' }]
    })

    expect(create).toHaveBeenCalledOnce()
    const istek = create.mock.calls[0][0]
    expect(istek.model).toBe(YEREL_MODEL)
    expect(istek.max_tokens).toBe(1000)
    expect(istek.extra_body).toEqual({ enable_thinking: false })
    expect(istek.response_format.type).toBe('json_object')
    expect(JSON.parse(istek.response_format.schema).required).toContain('fiyatYorumu')
    expect(cevap).toEqual({
      content: [{ type: 'text', text: '{"skor":7}' }],
      stop_reason: 'stop',
      usage: { prompt_tokens: 10, completion_tokens: 4 }
    })
  })
})
