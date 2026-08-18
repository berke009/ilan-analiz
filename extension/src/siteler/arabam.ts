import type { ListingDetail, ListRow } from 'shared'
import { trSayi, parseFiyat, metin, etiketAlani } from '../parseCommon'
import type { SiteAdaptoru } from './tip'
import kayit from './kayit.json'

const k = kayit.find(s => s.ad === 'arabam')!

const SATIR_SECICI = 'tr.listing-list-item[data-imp-id]'

// arabam.com detay sayfası sahibinden'den DAHA temiz: her alan
// .property-item > (.property-key, .property-value) çiftinde duruyor. Yani alanları
// KONUMA göre değil ETİKETE göre okuyoruz — sütun sırası değişse bile kırılmaz.
function ozellikler(doc: Document): Record<string, string> {
  const o: Record<string, string> = {}
  for (const p of doc.querySelectorAll('.property-item')) {
    const anahtar = metin(p.querySelector('.property-key'))
    const deger = gorunurMetin(p.querySelector('.property-value'))
    if (anahtar && deger) o[anahtar] = deger
  }
  return o
}

// arabam gizli yardımcı metinleri (kopyalama ipucu vb.) .dn sınıfıyla saklıyor ve
// textContent onları da döndürüyor: "İlan No" alanı "Kopyalandı 90000013" çıkıyordu.
// Fixture testi yakaladı. Kopyayı temizleyip okuyoruz — tek alana yama yapmak
// yeterli değildi, aynı desen her alanı kirletebilir.
function gorunurMetin(el: Element | null): string | null {
  if (!el) return null
  const kopya = el.cloneNode(true) as Element
  for (const gizli of kopya.querySelectorAll('.dn, [hidden]')) gizli.remove()
  return metin(kopya)
}

// Kırıntı: /ikinci-el/otomobil > /..../volkswagen > /..../volkswagen-polo > ... > en derin
// donanım. sahibinden'deki mantığın aynısı: en derin yol model araması, bir üstü yedek.
function aramaYollari(doc: Document): { model: string | null; ust: string | null; kategori: string | null } {
  const yollar = [...doc.querySelectorAll('#breadcrumb a[href]')]
    .map(a => a.getAttribute('href')!.split('?')[0]!)
    .filter(h => h.startsWith('/ikinci-el/'))
  return {
    model: yollar[yollar.length - 1] ?? null,
    ust: yollar.length > 1 ? yollar[yollar.length - 2]! : null,
    // ilk /ikinci-el/ kırıntısı kategoriyi verir: "Otomobil", "Arazi, SUV & Pickup"...
    kategori: metin(doc.querySelector('#breadcrumb a[href^="/ikinci-el/"]')) ?? null
  }
}

function detayOku(doc: Document, url: string): ListingDetail | null {
  const oz = ozellikler(doc)
  if (Object.keys(oz).length === 0) return null

  // İlan numarası: önce alan, olmazsa URL'in son parçası (/ilan/<slug>/<slug>/<id>)
  const ilanId = oz['İlan No']?.match(/\d{4,}/)?.[0]
    ?? url.split('?')[0]!.split('/').filter(Boolean).pop() ?? null
  if (!ilanId) return null

  const ilan: ListingDetail = {
    ilanId, url,
    baslik: metin(doc.querySelector('h1')) ?? '',
    fiyat: parseFiyat(metin(doc.querySelector('.desktop-information-price'))),
    kategori: null, marka: null, seri: null, model: null, yil: null, km: null,
    yakit: null, vites: null, agirHasarKayitli: null, kimden: null,
    il: null, ilce: null,
    aciklamaText: metin(doc.querySelector('.tab-description')),
    modelAramaPath: null, ustAramaPath: null,
    ekAlanlar: {}
  }

  for (const [etiket, deger] of Object.entries(oz)) {
    const alan = etiketAlani(etiket)
    if (alan === 'yil') ilan.yil = trSayi(deger)
    else if (alan === 'km') ilan.km = trSayi(deger)
    else if (alan) (ilan as any)[alan] = deger
    else ilan.ekAlanlar[etiket] = deger
  }

  // arabam'da "Ağır Hasar Kayıtlı" gibi ikili bir alan YOK; onun yerine ayrı bir
  // bölümde tramer TUTARI veriliyor ("Tramer tutarı 45.000 TL" / "Belirtilmemiş").
  // Bu sahibinden'in var/yok beyanından daha zengin. agirHasarKayitli null bırakılıyor
  // — uydurmak yerine bilinmiyor demek doğrusu; tutar ekAlanlar'dan modele gidiyor.
  const tramer = metin(doc.querySelector('.tramer-info'))
  if (tramer) ilan.ekAlanlar['Tramer'] = tramer.replace(/^Tramer tutarı\s*/i, '')

  const y = aramaYollari(doc)
  ilan.modelAramaPath = y.model
  ilan.ustAramaPath = y.ust
  ilan.kategori = y.kategori
  return ilan
}

function listeSatirlari(doc: Document): ListRow[] {
  const satirlar: ListRow[] = []
  for (const tr of doc.querySelectorAll(SATIR_SECICI)) {
    const ilanId = tr.getAttribute('data-imp-id')
    if (!ilanId) continue
    // Fiyatın kendi sınıfı var (span.listing-price) — "TL geçen hücre" tahminine gerek yok.
    const fiyat = parseFiyat(metin(tr.querySelector('span.listing-price')))
    // Yıl/km/renk sırayla .listing-text hücrelerinde; tarih hücresi .tac ile, konum
    // hücresi ise iç <span>'leriyle ayrışıyor. Sırayı değil ŞEKLİ kullanıyoruz:
    // yıl 4 haneli, km binlik ayıraçlı ve yıldan büyük.
    const metinler = [...tr.querySelectorAll('td.listing-text:not(.tac)')].map(td => metin(td) ?? '')
    const yil = metinler.map(trSayi).find(n => n != null && n > 1900 && n < 2100) ?? null
    const km = metinler.map(trSayi).find(n => n != null && n !== yil && n >= 0 && n < 3_000_000) ?? null
    const konum = tr.querySelector('td.listing-text:last-child')
    const konumSpan = konum ? [...konum.querySelectorAll('span')].map(s => metin(s)).filter(Boolean) : []

    satirlar.push({
      ilanId,
      url: tr.querySelector('a[href*="/ilan/"]')?.getAttribute('href')?.split('?')[0] ?? null,
      marka: null, seri: null,
      // Model sütunu marka+seri+donanımı TEK metinde veriyor ("Volkswagen Polo 1.2 TSi
      // Lounge"). Bölmeye çalışmak tahmin olur; ozellikCikar zaten metinden vites/yakıt
      // çıkarıyor ve karşılaştırma yıl bandı + o özelliklerle yapılıyor.
      model: metin(tr.querySelector('td.listing-modelname')),
      baslik: metin(tr.querySelector('td.horizontal-half-padder-minus')),
      yil, km, fiyat,
      il: konumSpan[0] ?? null
    })
  }
  return satirlar
}

export const arabam: SiteAdaptoru = {
  ad: k.ad,
  kok: k.kok,
  satirSecici: SATIR_SECICI,
  satirId: el => el.getAttribute('data-imp-id'),
  sayfaTipi(doc) {
    if (doc.querySelector('.property-item') && doc.querySelector('.desktop-information-price')) return 'detay'
    if (doc.querySelector(SATIR_SECICI)) return 'liste'
    return null
  },
  detayOku,
  listeSatirlari
}
