// Renk paleti — panelin shadow root'unda VE liste widget'larının kendi shadow root'unda
// aynı :host değişkenleri olarak kullanılır (bkz. liste.tsx ILERLEME_STIL).
//
// Yön: sıcak-nötr koyu zemin (araç iç mekânı / gece gösterge paneli), soğuk near-black değil.
// Ayrı bir accent rengi YOK: panelin karakter rengi skorun semantik rengidir — iyi araçta
// yeşil, riskli araçta kırmızı. Böylece panel her ilanda kendi kimliğini alır.
export const RENKLER = `
  --zemin: #191614; --yuzey: #221e1b; --yuzey2: #2a2521; --kenar: #35302c;
  --metin: #f0ece7; --metin2: #a89f96; --metin3: #6f665e;
  --yesil: #4fb06a; --sari: #d99a2b; --kirmizi: #e05c4f;
  --yesil-zemin: #1a2a1e; --sari-zemin: #2b2416; --kirmizi-zemin: #2d1c19;
  --sans: -apple-system, "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
`

export const STIL = `
:host { all: initial; ${RENKLER} }
* { box-sizing: border-box }

.panel { position: fixed; right: 16px; top: 90px; width: 344px; max-height: 84vh; overflow-y: auto;
  background: var(--zemin); color: var(--metin); border: 1px solid var(--kenar); border-radius: 8px;
  font: 12.5px/1.55 var(--sans); z-index: 999999; box-shadow: 0 16px 48px rgba(0,0,0,.55) }
.panel::-webkit-scrollbar { width: 8px }
.panel::-webkit-scrollbar-thumb { background: var(--kenar); border-radius: 4px }

/* Üst bar — sessiz, sadece kimlik ve küçültme */
.ustBar { display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; border-bottom: 1px solid var(--kenar);
  font: 600 11px/1 var(--sans); letter-spacing: .07em; text-transform: uppercase; color: var(--metin2) }
.kucult { cursor: pointer; background: none; border: none; color: var(--metin3);
  font: 400 15px/1 var(--sans); padding: 2px 4px }
.kucult:hover { color: var(--metin) }
.kucult:focus-visible { outline: 1px solid var(--metin2); outline-offset: 2px }

.govde { padding: 0 14px 14px }
.bolum { padding-top: 14px; margin-top: 14px; border-top: 1px solid var(--kenar) }
.bolum:first-child { padding-top: 14px; margin-top: 0; border-top: none }
.mikro { font: 700 9.5px/1 var(--sans); letter-spacing: .1em; text-transform: uppercase;
  color: var(--metin3); margin-bottom: 9px }

/* HERO — skor panelin tek cesur alanı, rengi araca göre değişir */
.skorBolum { display: flex; gap: 12px; align-items: stretch }
.skorKutu { flex: 0 0 88px; display: flex; flex-direction: column; align-items: center; justify-content: center;
  border-radius: 6px; padding: 10px 0 8px }
.skorSayi { font: 700 40px/1 var(--mono); font-variant-numeric: tabular-nums; letter-spacing: -.04em }
.skorAlt { font: 600 8.5px/1 var(--sans); letter-spacing: .12em; text-transform: uppercase; margin-top: 5px; opacity: .65 }
.skor-yesil { background: var(--yesil-zemin); color: var(--yesil) }
.skor-sari { background: var(--sari-zemin); color: var(--sari) }
.skor-kirmizi { background: var(--kirmizi-zemin); color: var(--kirmizi) }
.skorSag { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 8px; min-width: 0 }
.durumEtiket { font: 700 17px/1.15 var(--sans); letter-spacing: -.01em }
.skorBarZemin { height: 3px; background: var(--kenar); border-radius: 2px; overflow: hidden }
.skorBarDolu { display: block; height: 100% }
.skorBarDolu.skor-yesil { background: var(--yesil) }
.skorBarDolu.skor-sari { background: var(--sari) }
.skorBarDolu.skor-kirmizi { background: var(--kirmizi) }
.skorOlcek { display: flex; justify-content: space-between; font: 500 9px/1 var(--mono); color: var(--metin3) }

/* Chip'ler — ilanın nesnel etiketleri */
.chipler { display: flex; flex-wrap: wrap; gap: 4px }
.chip { font: 500 10.5px/1 var(--sans); padding: 4px 7px; border-radius: 3px;
  background: var(--yuzey); color: var(--metin2); border: 1px solid var(--kenar) }

/* Fiyat konumu — ölçek + ibre */
.slider { position: relative; height: 4px; border-radius: 2px; margin: 2px 0 6px;
  background: linear-gradient(90deg, var(--yesil), var(--sari), var(--kirmizi)) }
.isaret { position: absolute; top: -4px; width: 2px; height: 12px; background: var(--metin);
  transform: translateX(-50%); border-radius: 1px }
.sliderYazi { display: flex; justify-content: space-between; font: 500 9px/1 var(--sans);
  letter-spacing: .06em; text-transform: uppercase; color: var(--metin3) }
.medyanSatir { margin-top: 9px; font: 400 11.5px/1.4 var(--sans); color: var(--metin2);
  font-variant-numeric: tabular-nums }
.medyanSatir b { font: 600 11.5px/1.4 var(--mono); color: var(--metin) }

/* Pazarlık hedefi — panelin tek aksiyonu, öne çıkar */
.pazarlik { margin-top: 10px; padding: 9px 11px; background: var(--yuzey);
  border-left: 2px solid var(--yesil); border-radius: 0 4px 4px 0;
  display: flex; align-items: baseline; justify-content: space-between; gap: 8px }
.pazarlikEtiket { font: 600 9.5px/1 var(--sans); letter-spacing: .09em; text-transform: uppercase; color: var(--metin3) }
.pazarlikDeger { font: 700 16px/1 var(--mono); font-variant-numeric: tabular-nums; color: var(--yesil) }

/* Kilometre */
.kmSatir { display: flex; align-items: center; gap: 8px; margin-bottom: 6px }
.kmYorum { font: 400 12px/1.5 var(--sans); color: var(--metin2) }
.rozet { display: inline-block; font: 700 10px/1 var(--sans); letter-spacing: .04em;
  padding: 4px 7px; border-radius: 3px }
.rozet-yesil { background: var(--yesil-zemin); color: var(--yesil) }
.rozet-sari { background: var(--sari-zemin); color: var(--sari) }
.rozet-kirmizi { background: var(--kirmizi-zemin); color: var(--kirmizi) }
.rozet-notr { background: var(--yuzey2); color: var(--metin2) }

/* Uyarılar — sol şerit, rapor ritmi */
.uyari { padding: 7px 0 7px 10px; border-left: 2px solid var(--kenar); margin-bottom: 6px;
  font: 400 12px/1.45 var(--sans) }
.uyari:last-child { margin-bottom: 0 }
.uyari-kirmizi { border-left-color: var(--kirmizi) }
.uyari-sari { border-left-color: var(--sari) }

/* Kronik sorunlar */
.kronik { margin-bottom: 10px }
.kronik:last-child { margin-bottom: 0 }
.kronikBas { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 3px }
.kronikBaslik { font: 600 12px/1.35 var(--sans) }
.kronikAcik { font: 400 11.5px/1.45 var(--sans); color: var(--metin2) }

/* Artı / eksi */
.liste { margin-bottom: 12px }
.liste:last-child { margin-bottom: 0 }
.listeBas { font: 700 9.5px/1 var(--sans); letter-spacing: .1em; text-transform: uppercase; margin-bottom: 7px }
.listeBas.arti { color: var(--yesil) }
.listeBas.eksi { color: var(--kirmizi) }
.madde { display: flex; gap: 7px; font: 400 12px/1.45 var(--sans); margin-bottom: 5px }
.madde:last-child { margin-bottom: 0 }
.isaretci { flex: 0 0 auto; color: var(--metin3); font: 600 12px/1.45 var(--mono) }

.ozet { font: 400 12px/1.6 var(--sans); color: var(--metin2) }
/* Paylaşılan sonuç notu: bilgi, uyarı değil. Sarı/kırmızı kullanmıyoruz — bu bir
   sorun değil, kaynak beyanı; uyarı renkleri gerçek bayrakların işareti kalmalı. */
.paylasimNot { font: 400 11px/1.5 var(--sans); color: var(--metin3);
  border-left: 2px solid var(--kenar); padding-left: 9px }
.paylasimNot .tekrar { margin: 7px 6px 0 0 }
.paylasimOnay { margin-top: 7px; color: var(--metin2) }

/* Daha iyi alternatifler — tıklanabilir satırlar */
.altSatir { display: block; padding: 8px 10px; margin-bottom: 6px;
  background: var(--yuzey); border: 1px solid var(--kenar); border-radius: 4px;
  text-decoration: none; color: inherit }
.altSatir:last-child { margin-bottom: 0 }
.altSatir:hover { border-color: var(--metin2) }
.altSatir:focus-visible { outline: 1px solid var(--metin2); outline-offset: 2px }
.altBaslik { font: 600 12px/1.35 var(--sans); color: var(--metin);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.altDetay { font: 400 11px/1.4 var(--mono); font-variant-numeric: tabular-nums;
  color: var(--metin2); margin-top: 3px }
.altGerekce { font: 400 11px/1.4 var(--sans); color: var(--yesil); margin-top: 3px }
.altYok { font: 400 11.5px/1.5 var(--sans); color: var(--metin2);
  padding: 8px 10px; border-left: 2px solid var(--kenar) }

/* Karşılaştırılan ilanlar — katlanır (native details, JS yok) */
.benzerAcilir { margin-top: 10px }
.benzerOzet { cursor: pointer; list-style: none; font: 600 10.5px/1 var(--sans);
  letter-spacing: .04em; color: var(--metin2); padding: 6px 0; user-select: none;
  display: flex; align-items: center; gap: 5px }
.benzerOzet::-webkit-details-marker { display: none }
.benzerOzet::before { content: '▸'; font-size: 9px; color: var(--metin3); transition: transform .12s }
.benzerAcilir[open] .benzerOzet::before { transform: rotate(90deg) }
.benzerOzet:hover { color: var(--metin) }
.benzerAcilir summary:focus-visible { outline: 1px solid var(--metin2); outline-offset: 2px }
.benzerListe { display: flex; flex-direction: column; gap: 4px; margin-top: 4px }
.benzerSatir { display: block; padding: 6px 8px; border-left: 2px solid var(--kenar);
  text-decoration: none; color: inherit }
.benzerSatir:hover { border-left-color: var(--metin2); background: var(--yuzey) }
.benzerSatir:focus-visible { outline: 1px solid var(--metin2); outline-offset: 1px }
.benzerBaslik { display: block; font: 400 11.5px/1.35 var(--sans); color: var(--metin);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
.benzerDetay { display: block; font: 400 10.5px/1.35 var(--mono); font-variant-numeric: tabular-nums;
  color: var(--metin2); margin-top: 2px }

/* Durum ekranları */
.skeleton { height: 220px; border-radius: 6px; margin-top: 14px;
  background: linear-gradient(90deg, var(--yuzey) 25%, var(--yuzey2) 50%, var(--yuzey) 75%);
  background-size: 200% 100%; animation: par 1.4s linear infinite }
@keyframes par { to { background-position: -200% 0 } }
@media (prefers-reduced-motion: reduce) { .skeleton { animation: none } }
.hata { padding: 22px 4px; text-align: center; font: 400 12.5px/1.5 var(--sans); color: var(--metin2) }
.tekrar { margin-top: 10px; background: var(--yuzey); color: var(--metin); border: 1px solid var(--kenar);
  border-radius: 4px; padding: 7px 14px; cursor: pointer; font: 600 11.5px/1 var(--sans) }
.tekrar:hover { border-color: var(--metin2) }
.tekrar:focus-visible { outline: 1px solid var(--metin2); outline-offset: 2px }

/* Kota dolduğunda gösterilen yol */
.yukseltDugme { display: block; margin-top: 12px; padding: 10px 14px; border: none; border-radius: 5px;
  background: var(--yesil); color: #10190f; font: 700 13px/1.2 var(--sans); cursor: pointer;
  text-decoration: none; text-align: center }
.yukseltDugme:hover { filter: brightness(1.08) }
.yukseltDugme:focus-visible { outline: 1px solid var(--metin2); outline-offset: 2px }
.yukseltIpucu { margin-top: 9px; font: 400 11.5px/1.5 var(--sans); color: var(--metin3) }
`
