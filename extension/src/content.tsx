import { render } from 'preact'
import type { AnalysisResult, ListRow, PaylasimYazDurum } from 'shared'
import { adaptorSec, type SiteAdaptoru } from './siteler'
import { benzerIlanlarBul, listeDepo } from './similar'
import { lokalSonucGet, lokalSonucSet } from './lokalCache'
import { Panel, type PanelDurum } from './ui/Panel'
import { STIL } from './ui/stil'
import { listeAkisi } from './listeAkisi'
import type { CevapMesaj } from './mesaj'
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

  const cizSonuc = (
    sonuc: AnalysisResult, benzer: Awaited<ReturnType<typeof benzerIlanlarBul>>,
    paylasim?: { ts: number }, paylasimDurum?: PaylasimYazDurum
  ) => ciz({
    asama: 'hazir', sonuc, benzerler: benzer?.satirlar, paylasim, paylasimDurum,
    // Yenileme YALNIZ paylaşılan sonuçta anlamlı: kendi ürettiğin analizi aynı
    // anahtarla yeniden üretmek aynı şeyi tekrar satın almak olur.
    yenile: paylasim ? () => calistir(benzer, true) : undefined
  })

  const calistir = async (
    hazirBenzer?: Awaited<ReturnType<typeof benzerIlanlarBul>>, zorla = false
  ) => {
    ciz({ asama: 'yukleniyor' })
    const benzer = hazirBenzer !== undefined ? hazirBenzer : await benzerIlanlarBul(ilan, listeDepo(), site.ad)
    // siteAd paylaşılan önbellek anahtarının parçası: iki sitede aynı ilan numarası
    // çakışabiliyor ve birinin analizi öbürüne servis edilirdi.
    const cevap: CevapMesaj = await tarayici.runtime.sendMessage({ tip: 'analyze', istek: { ilan, benzerFiyatlar: benzer?.fiyatlar ?? [], siteAd: site.ad, zorla } })
    if (!cevap.ok) { ciz({ asama: 'hata', mesaj: cevap.hata, tekrar: () => calistir() }); return }
    const sonuc = cevap.veri as AnalysisResult
    const paylasim = cevap.kaynak === 'paylasilan' && cevap.paylasimTs != null
      ? { ts: cevap.paylasimTs } : undefined
    await lokalSonucSet(ilan.ilanId, ilan.fiyat!.tutar, sonuc, paylasim)
    // Yerel önbellek TAZE sonuçla üzerine yazılıyor ve paylaşım işareti düşüyor:
    // yenileme sonrası aynı ilanı tekrar açan kullanıcı kendi analizini görmeli.
    cizSonuc(sonuc, benzer, paylasim, cevap.paylasimDurum)
  }
  const eldeki = await lokalSonucGet(ilan.ilanId, ilan.fiyat.tutar)
  if (eldeki) {
    // AI sonucu cache'ten anında gelsin; karşılaştırma satırları yerel depodan okunur
    // (ağ yok, bedava) — kullanıcı bu arada bir liste sayfası gezmişse artık elde olabilir.
    cizSonuc(eldeki.sonuc, null, eldeki.paylasim)
    const benzer = await benzerIlanlarBul(ilan, listeDepo(), site.ad)
    // Cache'teki sonuç karşılaştırma bulunamadan üretilmişse fiyat konumu ve pazarlık
    // hedefi eksiktir; artık karşılaştırma varken o eksik hâli göstermeye devam etme.
    if (eldeki.sonuc.fiyatIstatistik == null && benzer != null) { await calistir(benzer); return }
    cizSonuc(eldeki.sonuc, benzer, eldeki.paylasim)
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
