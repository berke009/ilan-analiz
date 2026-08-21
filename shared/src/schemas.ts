import { z } from 'zod'

export const FiyatSchema = z.object({
  tutar: z.number().positive(),
  paraBirimi: z.enum(['TL', 'USD', 'EUR', 'GBP'])
})

export const ListingDetailSchema = z.object({
  ilanId: z.string().min(1),
  url: z.string(),
  baslik: z.string().min(1),
  fiyat: FiyatSchema.nullable(),
  kategori: z.string().nullable(),
  marka: z.string().nullable(),
  seri: z.string().nullable(),
  model: z.string().nullable(),
  yil: z.number().int().nullable(),
  km: z.number().nullable(),
  yakit: z.string().nullable(),
  vites: z.string().nullable(),
  agirHasarKayitli: z.string().nullable(),
  kimden: z.string().nullable(),
  il: z.string().nullable(),
  ilce: z.string().nullable(),
  aciklamaText: z.string().nullable(),
  modelAramaPath: z.string().nullable(),
  // bir üst kırıntı (model → seri): en derin yol az ilan döndürürse buna düşülür
  ustAramaPath: z.string().nullable().default(null),
  ekAlanlar: z.record(z.string())
})

export const ListRowSchema = z.object({
  ilanId: z.string().min(1),
  url: z.string().nullable(),
  marka: z.string().nullable(),
  seri: z.string().nullable(),
  model: z.string().nullable(),
  baslik: z.string().nullable(),
  yil: z.number().int().nullable(),
  km: z.number().nullable(),
  fiyat: FiyatSchema.nullable(),
  il: z.string().nullable()
})

export const BayrakSchema = z.object({
  tip: z.enum(['kirmizi', 'sari']),
  metin: z.string().min(1)
})

export const FiyatIstatistikSchema = z.object({
  medyan: z.number(), p25: z.number(), p75: z.number(),
  n: z.number().int(), yuzdelik: z.number().min(0).max(100)
})

export const KronikSorunSchema = z.object({
  baslik: z.string(),
  aciklama: z.string(),
  onem: z.enum(['yuksek', 'orta', 'dusuk'])
})

export const KmDurumSchema = z.object({
  beklenenKm: z.number(),
  oran: z.number(),
  etiket: z.enum(['sifir-ayarinda', 'cok-dusuk', 'dusuk', 'normal', 'yuksek', 'cok-yuksek']),
  yorum: z.string()
})

// AI'ın döndürdüğü kısım — fiyatIstatistik backend'de deterministik eklenir
export const AiAnalysisSchema = z.object({
  skor: z.number().min(0).max(10),
  durumEtiketi: z.string().min(1),
  chipler: z.array(z.string()),
  bayraklar: z.array(BayrakSchema),
  avantajlar: z.array(z.string()),
  dezavantajlar: z.array(z.string()),
  ozet: z.string().min(1),
  pazarlikHedefi: z.number().nullable(),
  fiyatYorumu: z.string()
})

export const AnalysisResultSchema = AiAnalysisSchema.extend({
  fiyatIstatistik: FiyatIstatistikSchema.nullable(),
  kmDurum: KmDurumSchema.nullable(),
  kronikSorunlar: z.array(KronikSorunSchema)
})

export const ScoreResultSchema = z.object({
  ilanId: z.string(),
  skor: z.number().min(0).max(10),
  etiketler: z.array(z.string()).max(2),
  tekCumle: z.string()
})

export const ModelProfileSchema = z.object({
  kronikSorunlar: z.array(KronikSorunSchema),
  artilar: z.array(z.string()),
  eksiler: z.array(z.string()),
  segmentNotu: z.string()
})

export const AnalyzeRequestSchema = z.object({
  ilan: ListingDetailSchema,
  benzerFiyatlar: z.array(z.number().positive())
})

// --- Hesap / abonelik ---
export const KayitRequestSchema = z.object({
  eposta: z.string().email().max(200).transform(s => s.trim().toLowerCase()),
  parola: z.string().min(8).max(200)
})
export const GirisRequestSchema = KayitRequestSchema

export const HesapSchema = z.object({
  eposta: z.string(),
  plan: z.enum(['ucretsiz', 'premium']),
  // premium'da aboneliğin bittiği an; ücretsizde null
  abonelikBitis: z.string().nullable(),
  gunlukHak: z.number().int(),
  bugunKullanilan: z.number().int()
})

export const BatchScoreRequestSchema = z.object({
  satirlar: z.array(ListRowSchema).max(20),
  sayfaFiyatlari: z.array(z.number().positive())
})

export type Fiyat = z.infer<typeof FiyatSchema>
export type ListingDetail = z.infer<typeof ListingDetailSchema>
export type ListRow = z.infer<typeof ListRowSchema>
export type Bayrak = z.infer<typeof BayrakSchema>
export type FiyatIstatistik = z.infer<typeof FiyatIstatistikSchema>
export type KronikSorun = z.infer<typeof KronikSorunSchema>
export type KmDurum = z.infer<typeof KmDurumSchema>
export type AiAnalysis = z.infer<typeof AiAnalysisSchema>
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>
export type ScoreResult = z.infer<typeof ScoreResultSchema>
export type ModelProfile = z.infer<typeof ModelProfileSchema>
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>
export type BatchScoreRequest = z.infer<typeof BatchScoreRequestSchema>
export type KayitRequest = z.infer<typeof KayitRequestSchema>
export type GirisRequest = z.infer<typeof GirisRequestSchema>
export type Hesap = z.infer<typeof HesapSchema>
