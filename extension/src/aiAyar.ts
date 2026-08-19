import { anahtarGetir } from './anahtar'
import { tarayici } from './tarayici'

export type AiSaglayici = 'yerel' | 'gemini'

const DEPO = 'aiSaglayici'

export async function aiSaglayiciGetir(): Promise<AiSaglayici> {
  const kayitli = (await tarayici.storage.local.get(DEPO))[DEPO]
  if (kayitli === 'yerel' || kayitli === 'gemini') return kayitli

  // Mevcut kullanıcıyı habersizce başka motora geçirme. Anahtar kaydetmiş biri
  // Gemini ile devam eder; yeni kurulumlarda ise hiçbir veri cihazdan çıkmaz.
  return await anahtarGetir() ? 'gemini' : 'yerel'
}

export async function aiSaglayiciKaydet(saglayici: AiSaglayici): Promise<void> {
  await tarayici.storage.local.set({ [DEPO]: saglayici })
}
