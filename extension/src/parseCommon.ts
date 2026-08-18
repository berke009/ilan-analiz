import type { Fiyat, ListingDetail } from 'shared'

export function trSayi(s: string | null | undefined): number | null {
  if (!s) return null
  const temiz = s.replace(/\./g, '').replace(/[^\d]/g, '')
  if (!temiz) return null
  return parseInt(temiz, 10)
}

export function parseFiyat(s: string | null | undefined): Fiyat | null {
  if (!s) return null
  const birim = s.includes('TL') ? 'TL' : s.includes('EUR') ? 'EUR' : s.includes('USD') || s.includes('$') ? 'USD' : s.includes('GBP') ? 'GBP' : 'TL'
  const tutar = trSayi(s)
  if (!tutar) return null
  return { tutar, paraBirimi: birim }
}

export function metin(el: Element | null): string | null {
  const t = el?.textContent?.trim().replace(/\s+/g, ' ')
  return t || null
}

// Türkçe etiket → alan eşlemesi. İki sitede de aynı kavramlar farklı yazılıyor
// ("Yakıt" / "Yakıt Tipi", "KM" / "Kilometre", "Vites" / "Vites Tipi"), o yüzden
// tam eşleşme tutmazsa anahtar kelimeye düşülür. Eşleşmeyen her şey ekAlanlar'a gider.
const ETIKET: Record<string, keyof ListingDetail> = {
  'Marka': 'marka', 'Seri': 'seri', 'Model': 'model', 'Yıl': 'yil',
  'KM': 'km', 'Km': 'km', 'Yakıt': 'yakit', 'Yakıt Tipi': 'yakit',
  'Vites': 'vites', 'Ağır Hasar Kayıtlı': 'agirHasarKayitli', 'Kimden': 'kimden'
}

export function etiketAlani(etiket: string): keyof ListingDetail | null {
  const tam = ETIKET[etiket]
  if (tam) return tam
  const n = etiket.toLocaleLowerCase('tr')
  if (n.includes('yakıt')) return 'yakit'
  if (n.includes('vites') || n.includes('şanzıman')) return 'vites'
  if (n.includes('ağır hasar')) return 'agirHasarKayitli'
  if (n === 'km' || n.includes('kilometre')) return 'km'
  return null
}
