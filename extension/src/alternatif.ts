import type { ListingDetail, ListRow } from 'shared'

export type Alternatif = { satir: ListRow; gerekce: string }

function dahaIyiDeger(ilan: ListingDetail, aday: ListRow): boolean {
  const hedefFiyat = ilan.fiyat?.paraBirimi === 'TL' ? ilan.fiyat.tutar : null
  const fiyat = aday.fiyat?.tutar ?? null
  if (hedefFiyat == null || fiyat == null) return false
  const hedefKm = ilan.km, km = aday.km
  const hedefYil = ilan.yil, yil = aday.yil

  const dahaAzaAynisi = fiyat < hedefFiyat
    && (hedefKm == null || km == null || km <= hedefKm * 1.15)
    && (hedefYil == null || yil == null || yil >= hedefYil)

  const ayniParayaDahaIyisi = fiyat <= hedefFiyat * 1.02
    && (
      (hedefKm != null && km != null && km <= hedefKm * 0.8)
      || (hedefYil != null && yil != null && yil >= hedefYil + 1)
    )

  return dahaAzaAynisi || ayniParayaDahaIyisi
}

function kazancPuani(ilan: ListingDetail, aday: ListRow): number {
  const hedefFiyat = ilan.fiyat?.paraBirimi === 'TL' ? ilan.fiyat.tutar : null
  let puan = 0
  if (hedefFiyat != null && aday.fiyat?.tutar != null) puan += (hedefFiyat - aday.fiyat.tutar) / hedefFiyat
  if (ilan.km != null && aday.km != null) puan += ((ilan.km - aday.km) / Math.max(ilan.km, 1)) * 0.5
  if (ilan.yil != null && aday.yil != null) puan += (aday.yil - ilan.yil) * 0.05
  return puan
}

function gerekceYaz(ilan: ListingDetail, aday: ListRow): string {
  const hedefFiyat = ilan.fiyat?.paraBirimi === 'TL' ? ilan.fiyat.tutar : null
  const fiyatFarki = hedefFiyat != null && aday.fiyat?.tutar != null ? hedefFiyat - aday.fiyat.tutar : null
  const kmFarki = ilan.km != null && aday.km != null ? ilan.km - aday.km : null
  const yilFarki = ilan.yil != null && aday.yil != null ? aday.yil - ilan.yil : null

  const maddeler: string[] = []
  if (fiyatFarki != null && fiyatFarki > 0) maddeler.push(`${fiyatFarki.toLocaleString('tr-TR')} TL daha ucuz`)
  if (kmFarki != null && kmFarki > 0) maddeler.push(`${kmFarki.toLocaleString('tr-TR')} km daha az`)
  if (maddeler.length < 2 && yilFarki != null && yilFarki > 0) maddeler.push(`${yilFarki} yaş daha yeni`)

  if (maddeler.length === 0) return 'benzer koşullarda alternatif'
  const ayniFiyat = fiyatFarki == null || fiyatFarki <= 0
  return ayniFiyat ? `aynı fiyata ${maddeler.join(', ')}` : maddeler.join(', ')
}

export function alternatifSec(ilan: ListingDetail, adaylar: ListRow[], adet = 3): Alternatif[] {
  return adaylar
    .filter(a => dahaIyiDeger(ilan, a))
    .sort((a, b) => kazancPuani(ilan, b) - kazancPuani(ilan, a))
    .slice(0, adet)
    .map(satir => ({ satir, gerekce: gerekceYaz(ilan, satir) }))
}
