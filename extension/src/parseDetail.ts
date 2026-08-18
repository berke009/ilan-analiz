import type { ListingDetail } from 'shared'
import { trSayi, parseFiyat, metin, etiketAlani } from './parseCommon'

export function parseDetail(doc: Document, url: string): ListingDetail | null {
  const kok = doc.querySelector('#classifiedDetail')
  if (!kok) return null

  // DOM fallback: "İlan No" etiketli li'nin span'i (URL'de id yoksa kullanılır)
  const ilanNoLi = [...doc.querySelectorAll('ul.classifiedInfoList li')]
    .find(li => li.querySelector('strong')?.textContent?.replace(/:$/, '').trim() === 'İlan No')
    ?.querySelector('span')?.textContent?.trim()

  // URL'in SONUNDAKI uzun (≥5 haneli) rakam grubu — slug içindeki kısa rakamları eler
  const ilanId = url.match(/(\d{5,})(?:\/detay)?\/?$/)?.[1]
    ?? ilanNoLi
    ?? null
  const baslik = metin(doc.querySelector('.classifiedDetailTitle h1'))
  const fiyat = parseFiyat(metin(doc.querySelector('.classifiedInfo h3')))
  if (!ilanId || !baslik || !fiyat) return null

  const ilan: ListingDetail = {
    ilanId, url, baslik, fiyat,
    kategori: null, marka: null, seri: null, model: null, yil: null, km: null,
    yakit: null, vites: null, agirHasarKayitli: null, kimden: null,
    il: null, ilce: null, aciklamaText: null, modelAramaPath: null, ustAramaPath: null, ekAlanlar: {}
  }

  // Özellik listesi: her li'de strong=etiket, span=değer
  for (const li of doc.querySelectorAll('ul.classifiedInfoList li')) {
    const etiket = metin(li.querySelector('strong'))?.replace(/:$/, '')
    const deger = metin(li.querySelector('span'))
    if (!etiket || !deger) continue
    const alan = etiketAlani(etiket)
    if (alan === 'yil') ilan.yil = trSayi(deger)
    else if (alan === 'km') ilan.km = trSayi(deger)
    else if (alan) (ilan as any)[alan] = deger
    else ilan.ekAlanlar[etiket] = deger
  }

  // Adres: "İzmir / Konak / Çınarlı Mh." biçimli linkler
  const adres = [...doc.querySelectorAll('.classifiedInfo h2 a')].map(a => metin(a)).filter(Boolean)
  ilan.il = adres[0] ?? null
  ilan.ilce = adres[1] ?? null

  ilan.aciklamaText = metin(doc.querySelector('#classifiedDescription'))?.slice(0, 8000) ?? null

  // Breadcrumb (canlı yapı: .search-result-bc > ul > li.bc-item > a).
  // li.bc-item içinde ayrıca .bc-tooltip var — kardeş modellerin açılır listesi;
  // '> a' ile yalnız kırıntının kendi linki alınır, tooltip'teki onlarca link değil.
  const kirinti = [...doc.querySelectorAll('.bc-item > a')]
  ilan.kategori = metin(kirinti[1] ?? null) // [0]=Vasıta, [1]=kategori
  const yol = (a: Element | undefined) => a?.getAttribute('href')?.split('?')[0] ?? null
  // en derin kırıntı donanım seviyesinde olabiliyor (ör. /mercedes-benz-c-serisi-c-200-amg);
  // o kadar dar aramada 5 ilan bile çıkmayabildiği için bir üstünü de taşıyoruz
  ilan.modelAramaPath = yol(kirinti[kirinti.length - 1])
  ilan.ustAramaPath = kirinti.length > 3 ? yol(kirinti[kirinti.length - 2]) : null

  return ilan
}
