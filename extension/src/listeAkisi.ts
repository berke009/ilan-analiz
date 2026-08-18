import { render, h } from 'preact'
import type { ListRow, ScoreResult } from 'shared'
import { listeSatirlariKaydet, listeDepo } from './similar'
import type { SiteAdaptoru } from './siteler'
import { chunk, rozetBas, Kart, Ilerleme, LISTE_STIL, ILERLEME_STIL, type IlerlemeDurum } from './ui/liste'

export async function listeAkisi(
  site: SiteAdaptoru,
  gonder: (satirlar: ListRow[], fiyatlar: number[]) => Promise<ScoreResult[] | null>
): Promise<void> {
  const satirlar = site.listeSatirlari(document).filter(s => s.fiyat?.paraBirimi === 'TL')
  if (satirlar.length === 0) return

  // Kullanıcının GÖRDÜĞÜ satırların TAMAMINI bu aramanın yoluna yaz: detay sayfasındaki
  // fiyat karşılaştırmasının tek kaynağı bu (ağ isteği yok, sayfa zaten açık).
  // Rozet döngüsünün İÇİNDE değil burada: orası 20'şerlik gruplarla ilerliyor ve her
  // grup bir öncekini ezerdi. Rozetler kapalı olsa (bakım) bile kayıt yapılmalı.
  // Anahtara SİTE de giriyor: iki farklı sitede aynı yol (/otomobil) çakışır ve
  // bir sitenin satırları öbürünün karşılaştırmasına karışırdı.
  listeSatirlariKaydet(site.ad, location.pathname, satirlar, listeDepo()).catch(() => {})

  // Satır stilleri sayfaya (rozetler shadow dışında), widget shadow'a
  const sayfaStil = document.createElement('style')
  sayfaStil.textContent = LISTE_STIL
  document.head.appendChild(sayfaStil)

  const host = document.createElement('div')
  document.body.appendChild(host)
  const golge = host.attachShadow({ mode: 'open' })
  const stil = document.createElement('style')
  stil.textContent = ILERLEME_STIL
  golge.appendChild(stil)
  const kok = document.createElement('div')
  golge.appendChild(kok)

  let acikKart: ScoreResult | null = null
  let kartYer = { x: 0, y: 0 }
  const durum: IlerlemeDurum = { yapilan: 0, toplam: satirlar.length, durduruldu: false, durdur: () => { durum.durduruldu = true; ciz() } }

  const ciz = () => render(
    h('div', null,
      h(Ilerleme, { d: durum }),
      acikKart && h('div', { style: `position:fixed;left:${kartYer.x}px;top:${kartYer.y}px;z-index:999999` },
        h(Kart, { s: acikKart, kapat: () => { acikKart = null; ciz() } }))
    ), kok)
  ciz()

  const acKart = (s: ScoreResult, el: Element) => {
    const r = el.getBoundingClientRect()
    kartYer = { x: Math.min(r.left, innerWidth - 260), y: r.bottom + 6 }
    acikKart = s; ciz()
  }

  const fiyatlar = satirlar.map(s => s.fiyat!.tutar)
  const trMap = new Map<string, Element>()
  for (const el of document.querySelectorAll(site.satirSecici)) {
    const id = site.satirId(el)
    if (id && !trMap.has(id)) trMap.set(id, el) // galeri kartındaki iç <tr> dıştaki <td>'yi ezmesin
  }

  for (const grup of chunk(satirlar, 20)) {
    if (durum.durduruldu) break
    const sonuclar = await gonder(grup, fiyatlar)
    if (!sonuclar) break // hata: sessizce dur, widget son durumda kalır
    for (const s of sonuclar) {
      const tr = trMap.get(s.ilanId)
      if (tr) rozetBas(tr, s, acKart)
    }
    durum.yapilan += grup.length
    ciz()
  }
}
