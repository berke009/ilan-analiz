import { render } from 'preact'
import type { AnalysisResult, ListRow } from 'shared'
import { adaptorSec, type SiteAdaptoru } from './siteler'
import { benzerIlanlarBul, listeDepo, type BenzerSonuc } from './similar'
import { lokalSonucGet, lokalSonucSet } from './lokalCache'
import { Panel, type PanelDurum } from './ui/Panel'
import { STIL } from './ui/stil'
import { listeAkisi } from './listeAkisi'
import type { CevapMesaj } from './mesaj'
import { aiSaglayiciGetir } from './aiAyar'
import { analizCalistir } from './analizCalistir'
import { YEREL_MODEL, yerelAiClient } from './yerelAi'
import { tarayici } from './tarayici'

// Siteye özel HİÇBİR bilgi bu dosyada yok; hepsi adaptörden geliyor (bkz. siteler/).
export function mountPanel(siteKok: string): (d: PanelDurum) => void {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const golge = host.attachShadow({ mode: 'open' })
  const stil = document.createElement('style')
  stil.textContent = STIL
  golge.appendChild(stil)
  const kap = document.createElement('div')
  golge.appendChild(kap)
  return (d: PanelDurum) => render(<Panel durum={d} kok={siteKok} />, kap)
}

async function detayAkisi(site: SiteAdaptoru) {
  const ciz = mountPanel(site.kok)
  ciz({ asama: 'yukleniyor' })
  const ilan = site.detayOku(document, location.href)
  if (!ilan || !ilan.fiyat) { ciz({ asama: 'okunamadi' }); return }

  const cizSonuc = (sonuc: AnalysisResult, benzer: BenzerSonuc | null) =>
    ciz({ asama: 'hazir', sonuc, benzerler: benzer?.satirlar })

  const calistir = async (hazirBenzer?: BenzerSonuc | null) => {
    ciz({ asama: 'yukleniyor' })
    const benzer = hazirBenzer !== undefined ? hazirBenzer : await benzerIlanlarBul(ilan, listeDepo(), site.ad)
    const saglayici = await aiSaglayiciGetir()
    let cevap: CevapMesaj

    if (saglayici === 'yerel') {
      let motorHazir = false
      try {
        const ai = await yerelAiClient(rapor => {
          const yuzde = Math.round(rapor.progress * 100)
          ciz({ asama: 'yukleniyor', mesaj: `Yerel model hazırlanıyor · %${yuzde}`, ilerleme: rapor.progress })
        })
        motorHazir = true
        ciz({ asama: 'yukleniyor', mesaj: 'İlan cihazında analiz ediliyor…' })
        const sonuc = await analizCalistir(ai, YEREL_MODEL, { ilan, benzerFiyatlar: benzer?.fiyatlar ?? [] })
        cevap = sonuc ? { ok: true, veri: sonuc } : { ok: false, hata: 'yerelAi' }
      } catch (hata) {
        console.error('[YEREL AI]', hata)
        const mesaj = String(hata instanceof Error ? hata.message : hata)
        cevap = {
          ok: false,
          hata: mesaj.includes('WEBGPU_YOK') ? 'webgpuYok' : motorHazir ? 'yerelAi' : 'modelIndirme'
        }
      }
    } else {
      cevap = await tarayici.runtime.sendMessage({
        tip: 'analyze', istek: { ilan, benzerFiyatlar: benzer?.fiyatlar ?? [] }
      })
    }

    if (!cevap.ok) { ciz({ asama: 'hata', mesaj: cevap.hata, tekrar: () => calistir() }); return }
    const sonuc = cevap.veri as AnalysisResult
    await lokalSonucSet(ilan.ilanId, ilan.fiyat!.tutar, saglayici, sonuc)
    cizSonuc(sonuc, benzer)
  }
  const saglayici = await aiSaglayiciGetir()
  const eldeki = await lokalSonucGet(ilan.ilanId, ilan.fiyat.tutar, saglayici)
  if (eldeki) {
    // AI sonucu cache'ten anında gelsin; karşılaştırma satırları yerel depodan okunur
    // (ağ yok, bedava) — kullanıcı bu arada bir liste sayfası gezmişse artık elde olabilir.
    cizSonuc(eldeki, null)
    const benzer = await benzerIlanlarBul(ilan, listeDepo(), site.ad)
    // Cache'teki sonuç karşılaştırma bulunamadan üretilmişse fiyat konumu ve pazarlık
    // hedefi eksiktir; artık karşılaştırma varken o eksik hâli göstermeye devam etme.
    if (eldeki.fiyatIstatistik == null && benzer != null) { await calistir(benzer); return }
    cizSonuc(eldeki, benzer)
    return
  }

  await calistir()
}

// Hangi sitedeyiz? Adaptör yoksa uzantı hiç karışmaz — manifest yanlışlıkla fazla
// bir adresle eşleşse bile sayfaya dokunulmamış olur.
const site = adaptorSec(location.hostname)
if (site) {
  const tip = site.sayfaTipi(document)
  if (tip === 'detay') detayAkisi(site)
  else if (tip === 'liste') {
    listeAkisi(site, async (satirlar: ListRow[], fiyatlar: number[]) => {
      const cevap: CevapMesaj = await tarayici.runtime.sendMessage({ tip: 'batchScore', istek: { satirlar, sayfaFiyatlari: fiyatlar } })
      return cevap.ok ? (cevap.veri as { sonuclar: any[] }).sonuclar : null
    })
  }
}
