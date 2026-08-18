import type { AnalyzeRequest, BatchScoreRequest } from 'shared'

export type IstekMesaj =
  | { tip: 'analyze'; istek: AnalyzeRequest }
  | { tip: 'batchScore'; istek: BatchScoreRequest }
  | { tip: 'popupAc' }

export type CevapMesaj =
  | { ok: true; veri: unknown }
  | { ok: false; hata: string }
