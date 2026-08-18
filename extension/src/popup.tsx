import { render } from 'preact'
import { Anahtar } from './ui/Anahtar'
import { RENKLER } from './ui/stil'

// Popup kendi belgesi; shadow DOM'a gerek yok, stil kimseyle çakışmıyor.
const STIL = `
:root { ${RENKLER} }
* { box-sizing: border-box }
body { margin: 0; width: 320px; background: var(--zemin); color: var(--metin);
  font: 13px/1.55 var(--sans); padding: 16px }

.baslik { font: 700 11px/1 var(--sans); letter-spacing: .09em; text-transform: uppercase;
  color: var(--metin3); margin-bottom: 14px }
.bekle { color: var(--metin2); padding: 18px 0; text-align: center }

.sekmeler { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid var(--kenar) }
.sekme { flex: 1; background: none; border: none; border-bottom: 2px solid transparent;
  color: var(--metin3); font: 600 12.5px/1 var(--sans); padding: 9px 0; cursor: pointer }
.sekme.etkin { color: var(--metin); border-bottom-color: var(--yesil) }
.sekme:hover { color: var(--metin) }
.sekme:focus-visible { outline: 1px solid var(--metin2); outline-offset: 2px }

.etiket { display: block; font: 600 10px/1 var(--sans); letter-spacing: .07em;
  text-transform: uppercase; color: var(--metin3); margin: 12px 0 6px }
.giris { width: 100%; background: var(--yuzey); border: 1px solid var(--kenar); border-radius: 5px;
  color: var(--metin); font: 400 13px/1 var(--sans); padding: 9px 10px }
.giris::placeholder { color: var(--metin3) }
.giris:focus { outline: none; border-color: var(--metin2) }

.anaDugme { display: block; width: 100%; text-align: center; text-decoration: none;
  margin-top: 14px; background: var(--yesil); color: #10190f; border: none; border-radius: 5px;
  padding: 10px; cursor: pointer; font: 700 13px/1.2 var(--sans) }
.anaDugme:hover { filter: brightness(1.08) }
.anaDugme:disabled { opacity: .55; cursor: default }
.ikinciDugme { width: 100%; margin-top: 8px; background: none; color: var(--metin2);
  border: 1px solid var(--kenar); border-radius: 5px; padding: 9px; cursor: pointer;
  font: 600 12.5px/1 var(--sans) }
.ikinciDugme:hover { color: var(--metin); border-color: var(--metin2) }
.anaDugme:focus-visible, .ikinciDugme:focus-visible { outline: 1px solid var(--metin2); outline-offset: 2px }

.hataKutu { margin-top: 12px; padding: 8px 10px; border-left: 2px solid var(--kirmizi);
  background: var(--kirmizi-zemin); color: var(--metin); font: 400 12px/1.45 var(--sans) }
.ipucu { margin: 10px 0 0; color: var(--metin3); font: 400 11.5px/1.5 var(--sans) }
.baglantiDugme { display: block; margin: 10px 0 0; background: none; border: none; padding: 0;
  color: var(--metin2); font: 400 11.5px/1.4 var(--sans); text-decoration: underline; cursor: pointer }
.baglantiDugme:hover { color: var(--metin) }
.baglantiDugme:focus-visible { outline: 1px solid var(--metin2); outline-offset: 2px }

.ustSatir { display: flex; align-items: center; justify-content: space-between; gap: 8px }
.eposta { font: 600 13px/1.3 var(--sans); overflow: hidden; text-overflow: ellipsis; white-space: nowrap }
.plan { flex: 0 0 auto; font: 700 10px/1 var(--sans); letter-spacing: .04em; padding: 4px 7px;
  border-radius: 3px; background: var(--yuzey2); color: var(--metin2) }
.plan-premium { background: var(--yesil-zemin); color: var(--yesil) }

.kotaBlok { margin-top: 16px }
.kotaBas { display: flex; justify-content: space-between; align-items: baseline;
  font: 400 11.5px/1 var(--sans); color: var(--metin2); margin-bottom: 7px }
.kotaBas b { font: 600 12px/1 var(--mono); font-variant-numeric: tabular-nums; color: var(--metin) }
.cubukZemin { height: 4px; background: var(--kenar); border-radius: 2px; overflow: hidden }
.cubuk { display: block; height: 100%; background: var(--yesil) }
.kotaAlt { margin-top: 6px; font: 400 11.5px/1 var(--sans); color: var(--metin3) }
.form { display: block }
.kart { display: block }
.bilgi { margin-top: 14px; padding: 9px 11px; background: var(--yuzey); border-left: 2px solid var(--yesil);
  border-radius: 0 4px 4px 0; font: 400 12px/1.5 var(--sans); color: var(--metin2) }
`

const stil = document.createElement('style')
stil.textContent = STIL
document.head.appendChild(stil)

const kok = document.getElementById('kok')!
render(<><div class="baslik">İlan Analiz</div><Anahtar /></>, kok)
