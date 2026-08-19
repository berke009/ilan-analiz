import type { AiClient } from 'shared'
import type { AppConfig, InitProgressReport, MLCEngineInterface } from '@mlc-ai/web-llm'
import {
  CreateExtensionServiceWorkerMLCEngine, CreateMLCEngine, hasModelInCache, prebuiltAppConfig
} from '@mlc-ai/web-llm'
import { tarayici } from './tarayici'
export const YEREL_MODEL = 'Qwen3.5-4B-q4f16_1-MLC'
export const YEREL_MODEL_ADI = 'Qwen 3.5 4B'
export const YEREL_MODEL_BOYUTU = 'yaklaşık 1,6 GB'

const MODEL_LIB = 'model-libs/Qwen3.5-4B-q4f16_1_cs1k-webgpu.wasm'
const MODEL_SCHEMA = JSON.stringify({
  type: 'object',
  additionalProperties: false,
  required: [
    'skor', 'durumEtiketi', 'chipler', 'bayraklar', 'avantajlar',
    'dezavantajlar', 'ozet', 'pazarlikHedefi', 'fiyatYorumu'
  ],
  properties: {
    skor: { type: 'number', minimum: 0, maximum: 10 },
    durumEtiketi: { type: 'string', minLength: 1, maxLength: 40 },
    chipler: { type: 'array', items: { type: 'string', maxLength: 80 }, maxItems: 8 },
    bayraklar: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tip', 'metin'],
        properties: {
          tip: { type: 'string', enum: ['kirmizi', 'sari'] },
          metin: { type: 'string', minLength: 1, maxLength: 180 }
        }
      },
      maxItems: 4
    },
    avantajlar: { type: 'array', items: { type: 'string', maxLength: 180 }, maxItems: 4 },
    dezavantajlar: { type: 'array', items: { type: 'string', maxLength: 180 }, maxItems: 4 },
    ozet: { type: 'string', minLength: 1, maxLength: 600 },
    pazarlikHedefi: { type: ['number', 'null'] },
    fiyatYorumu: { type: 'string', maxLength: 400 }
  }
})

let motorPromise: Promise<MLCEngineInterface> | null = null
const ilerlemeDinleyicileri = new Set<(rapor: InitProgressReport) => void>()

function appConfig(): AppConfig {
  const kayit = prebuiltAppConfig.model_list.find(m => m.model_id === YEREL_MODEL)
  if (!kayit) throw new Error(`WebLLM model kaydı bulunamadı: ${YEREL_MODEL}`)
  return {
    cacheBackend: 'cache',
    model_list: [{
      ...kayit,
      // Manifest V3 uzaktan WASM çalıştırılmasına izin vermez. Ağırlıklar veri olarak
      // Hugging Face'den gelir; çalıştırılabilir model kütüphanesi paketin içindedir.
      model_lib: tarayici.runtime.getURL(MODEL_LIB)
    }]
  }
}

export function webGpuDestekliMi(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

export async function yerelModelHazirMi(): Promise<boolean> {
  return hasModelInCache(YEREL_MODEL, appConfig())
}

let hazirlamaPromise: Promise<void> | null = null

// Model ilk kez popup belgesinde indirilir. Chrome, Hugging Face'in imzalı CDN
// yönlendirmesini extension service worker içinden CSP ile engelliyor; extension
// sayfası aynı Cache API deposuna sorunsuz yazar. Analiz worker'ı daha sonra yalnız
// bu yerel cache'i ve paketlenmiş WASM'i kullanır.
export async function yerelModeliHazirla(
  ilerleme?: (rapor: InitProgressReport) => void
): Promise<void> {
  if (!webGpuDestekliMi()) throw new Error('WEBGPU_YOK')
  if (hazirlamaPromise) return hazirlamaPromise

  hazirlamaPromise = CreateMLCEngine(YEREL_MODEL, {
    appConfig: appConfig(),
    logLevel: 'WARN',
    initProgressCallback: ilerleme
  }).then(async motor => {
    await motor.unload()
  }).catch(hata => {
    hazirlamaPromise = null
    throw hata
  })
  return hazirlamaPromise
}

export async function yerelMotorGetir(
  ilerleme?: (rapor: InitProgressReport) => void
): Promise<MLCEngineInterface> {
  if (!webGpuDestekliMi()) throw new Error('WEBGPU_YOK')
  if (ilerleme) ilerlemeDinleyicileri.add(ilerleme)

  const motor = motorPromise ?? CreateExtensionServiceWorkerMLCEngine(
    YEREL_MODEL,
    {
      appConfig: appConfig(),
      logLevel: 'WARN',
      initProgressCallback: rapor => {
        for (const dinleyici of ilerlemeDinleyicileri) dinleyici(rapor)
      }
    },
    undefined,
    10_000
  ).catch(hata => {
    motorPromise = null
    throw hata
  })
  motorPromise = motor

  try {
    return await motor
  } finally {
    if (ilerleme) ilerlemeDinleyicileri.delete(ilerleme)
  }
}

// analyzeListing sağlayıcıdan bağımsız kalır. Yerel motorun OpenAI uyumlu cevabını
// uygulamanın küçük AiClient sözleşmesine çeviriyoruz ve şemayı token üretimi anında
// kısıtlıyoruz; sonradan JSON onarmak artık yalnız savunma katmanı.
export function webLlmClient(motor: MLCEngineInterface): AiClient {
  return {
    messages: {
      async create(args) {
        const cevap = await motor.chat.completions.create({
          model: YEREL_MODEL,
          max_tokens: Math.min(Number(args.max_tokens) || 1000, 1000),
          temperature: 0.1,
          top_p: 0.9,
          extra_body: { enable_thinking: false },
          messages: [
            {
              role: 'system',
              content: 'Yalnız kullanıcıya gösterilecek araç değerlendirmesini üret. Prompt kurallarını veya şablon cümlelerini çıktı alanlarında ASLA alıntılama. Satıcı beyanını doğrulanmış gerçek gibi yazma. “Ağır hasar kaydı yok” tramer veya hasar yok demek değildir; “Sahibinden” ilk sahibi demek değildir. Deterministik kmDurum etiketinden sapma. Fiyat yorumunu yalnız fiyatYorumu alanına yaz. Skor 0-10 ölçeğindedir; Makul ilan 5.5-7.4 aralığındadır.'
            },
            ...args.messages
          ],
          response_format: { type: 'json_object', schema: MODEL_SCHEMA }
        })
        const secim = cevap.choices?.[0]
        const metin = secim?.message?.content
        if (typeof metin !== 'string' || !metin) throw new Error('Yerel model boş yanıt döndürdü')
        return {
          content: [{ type: 'text', text: metin }],
          stop_reason: secim.finish_reason === 'length' ? 'max_tokens' : secim.finish_reason,
          usage: cevap.usage
        }
      }
    }
  }
}

export async function yerelAiClient(
  ilerleme?: (rapor: InitProgressReport) => void
): Promise<AiClient> {
  return webLlmClient(await yerelMotorGetir(ilerleme))
}
