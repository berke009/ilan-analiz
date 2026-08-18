import type { ListRow } from 'shared'
import { trSayi, parseFiyat } from './parseCommon'

// sahibinden'in üç arama görünümü de aynı parser'dan geçer:
//   Klasik (viewType yok)  → #searchResultsTable tr[data-id], tüm sütunlar dolu
//   Liste  (viewType=List) → aynı kap, ama marka/seri/model ve yıl/km SÜTUNLARI YOK
//   Galeri (viewType=Gallery) → #searchResultsTable hiç yok; td.searchResultsGalleryItem[data-id]
export const SATIR_SECICI = '#searchResultsTable tr[data-id], td.searchResultsGalleryItem[data-id]'

// Galeri kartında değerler "<span class=...>Yıl:</span>&nbsp; 1999" biçiminde;
// etiket span'ının metnini düşüp kalanı alıyoruz.
function galeriAlan(kok: Element, etiket: string): string | null {
  for (const satir of kok.querySelectorAll('.searchResultsGallerySubContent > div')) {
    const bas = satir.querySelector('.searchResultsGalleryAttributeTitle')
    if (!bas || bas.textContent?.trim() !== etiket) continue
    return (satir.textContent ?? '').replace(bas.textContent ?? '', '').replace(/\u00a0/g, ' ').trim() || null
  }
  return null
}

export function parseListRows(doc: Document): ListRow[] {
  const satirlar: ListRow[] = []
  const gorulen = new Set<string>()

  for (const kok of doc.querySelectorAll(SATIR_SECICI)) {
    const ilanId = kok.getAttribute('data-id')
    // galeri kartı içinde bir de iç <tr data-id> var; aynı ilanı iki kez alma
    if (!ilanId || gorulen.has(ilanId)) continue
    gorulen.add(ilanId)

    const galeri = kok.classList.contains('searchResultsGalleryItem')

    // marka / seri / model — yalnız klasik görünümde sütun olarak var
    const tags = [...kok.querySelectorAll('.searchResultsTagAttributeValue')]
    const marka = tags[0]?.textContent?.trim() ?? null
    const seri = tags[1]?.textContent?.trim() ?? null
    const model = tags[2]?.textContent?.trim() ?? null

    const link = kok.querySelector('a.classifiedTitle')
    const baslik = link?.textContent?.trim() ?? null
    const url = link?.getAttribute('href') ?? null

    const ozeller = [...kok.querySelectorAll('.searchResultsAttributeValue')]
    const yil = galeri ? trSayi(galeriAlan(kok, 'Yıl:')) : trSayi(ozeller[0]?.textContent)
    const km = galeri ? trSayi(galeriAlan(kok, 'KM:')) : trSayi(ozeller[1]?.textContent)

    const fiyat = parseFiyat(kok.querySelector('.searchResultsPriceValue')?.textContent)

    // klasik/liste: "İzmir<br>Bornova" — ilk satır il. galeri: "İstanbul / Beykoz"
    const konum = kok.querySelector('.searchResultsLocationValue')
    const il = galeri
      ? galeriAlan(kok, 'İl / İlçe:')?.split('/')[0]?.trim() || null
      : konum ? konum.innerHTML.split('<br')[0]?.trim() || null : null

    satirlar.push({ ilanId, url, marka, seri, model, baslik, yil, km, fiyat, il })
  }
  return satirlar
}
