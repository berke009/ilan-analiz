import type { ScoreResult } from 'shared'
import { skorRenk } from './skor'
import { RENKLER } from './stil'

export function chunk<T>(xs: T[], n: number): T[][] {
  const c: T[][] = []
  for (let i = 0; i < xs.length; i += n) c.push(xs.slice(i, i + n))
  return c
}

// Liste rozetleri shadow DOM DIŞINDA (satırların içinde) — stiller aa- önekiyle sayfaya enjekte edilir.
// Sayfa CSS'ine :host değişkenleri sızmasın diye burada düz (literal) renk değerleri kullanılır.
export const LISTE_STIL = `
tr.aa-yesil > td, td.aa-yesil { background: #eef7f0 !important }
tr.aa-sari > td, td.aa-sari { background: #fbf6e9 !important }
tr.aa-kirmizi > td, td.aa-kirmizi { background: #fbeeee !important }
.aa-rozet { position: absolute; top: 5px; left: 5px; z-index: 10; border-radius: 6px; padding: 3px 8px;
  font: 700 13px/1.1 -apple-system, sans-serif; color: #fff; cursor: pointer;
  box-shadow: 0 0 0 2px rgba(255,255,255,.9), 0 2px 6px rgba(0,0,0,.35) }
.aa-rozet.aa-r-yesil { background: #4fb06a } .aa-rozet.aa-r-sari { background: #d99a2b } .aa-rozet.aa-r-kirmizi { background: #e05c4f }
`

export function rozetBas(satir: Element, skor: ScoreResult, acKart: (s: ScoreResult, el: Element) => void): void {
  satir.classList.add(`aa-${skorRenk(skor.skor)}`)
  // klasik/liste görünümünde satır <tr>, ilk <td> küçük resim hücresi;
  // galeri görünümünde satırın kendisi <td>, resim içerideki .searchResultsLargeThumbnail'da.
  const hucre = satir.querySelector('.searchResultsLargeThumbnail') ?? satir.querySelector('td') ?? satir
  if (hucre.querySelector('.aa-rozet')) return
  ;(hucre as HTMLElement).style.position = 'relative'
  const rozet = document.createElement('span')
  rozet.className = `aa-rozet aa-r-${skorRenk(skor.skor)}`
  rozet.textContent = skor.skor.toFixed(1)
  rozet.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); acKart(skor, rozet) })
  hucre.appendChild(rozet)
}

// Popup kart + ilerleme widget'ı (shadow DOM içinde — panelle aynı koyu palet)
export type IlerlemeDurum = { yapilan: number; toplam: number; durduruldu: boolean; durdur: () => void }

export function Kart({ s, kapat }: { s: ScoreResult; kapat: () => void }) {
  return (
    <div class="kart">
      <div class="kartBaslik">
        <span class={`skor skor-${skorRenk(s.skor)}`}>{s.skor.toFixed(1)}</span>
        <button class="kartKapat" onClick={kapat}>×</button>
      </div>
      <div class="etiketler">{s.etiketler.map(e => <span class="etiket">{e}</span>)}</div>
      <div class="ozet">{s.tekCumle}</div>
    </div>
  )
}

export function Ilerleme({ d }: { d: IlerlemeDurum }) {
  return (
    <div class="ilerleme">
      <div class="ilerlemeBaslik">İlan Analiz</div>
      <div class="sayac">Analiz: {d.yapilan}/{d.toplam}</div>
      {!d.durduruldu && d.yapilan < d.toplam && <button class="durdur" onClick={d.durdur}>Durdur</button>}
    </div>
  )
}

export const ILERLEME_STIL = `
:host { all: initial; ${RENKLER} }
.ilerleme { position: fixed; right: 16px; bottom: 16px; z-index: 999999; width: 200px;
  background: var(--zemin); color: var(--metin); border: 1px solid var(--kenar); border-radius: 8px; padding: 12px;
  font: 12.5px/1.5 -apple-system, sans-serif; box-shadow: 0 10px 40px rgba(0,0,0,.5) }
.ilerlemeBaslik { font: 600 13px/1 -apple-system, sans-serif }
.sayac { font-size: 11.5px; color: var(--metin2); margin: 8px 0 }
.durdur { width: 100%; background: none; color: var(--metin); border: 1px solid var(--kenar);
  border-radius: 6px; padding: 7px; cursor: pointer; font-size: 12.5px }
.durdur:hover { color: var(--kirmizi); border-color: var(--kirmizi) }

.kart { position: fixed; z-index: 999999; width: 240px; background: var(--zemin); color: var(--metin); border: 1px solid var(--kenar);
  border-radius: 10px; padding: 12px; font: 12.5px/1.5 -apple-system, sans-serif; box-shadow: 0 10px 40px rgba(0,0,0,.5) }
.kartBaslik { display: flex; justify-content: space-between; align-items: center }
.kart .skor { font: 700 20px/1 -apple-system, sans-serif; padding: 4px 10px; border-radius: 6px }
.kart .skor.skor-yesil { background: var(--yesil-zemin); color: var(--yesil) }
.kart .skor.skor-sari { background: var(--sari-zemin); color: var(--sari) }
.kart .skor.skor-kirmizi { background: var(--kirmizi-zemin); color: var(--kirmizi) }
.kartKapat { cursor: pointer; background: none; border: 1px solid var(--kenar); border-radius: 4px;
  color: var(--metin2); font-size: 13px; line-height: 1; width: 22px; height: 22px }
.kartKapat:hover { color: var(--metin); border-color: var(--metin2) }
.etiketler { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0 }
.etiket { background: var(--yuzey2); border: 1px solid var(--kenar); border-radius: 20px; padding: 2px 8px;
  font-size: 11px; color: var(--metin2) }
.kart .ozet { font-size: 12.5px; color: var(--metin2) }
`
