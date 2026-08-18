import type { AnalysisResult, ListRow } from 'shared'
import { skorRenk } from './skor'
import type { Alternatif } from '../alternatif'
import { tarayici } from '../tarayici'

export type PanelDurum =
  | { asama: 'yukleniyor' } | { asama: 'okunamadi' }
  | { asama: 'hata'; mesaj: string; tekrar: () => void }
  | { asama: 'hazir'; sonuc: AnalysisResult; alternatifler?: Alternatif[]; benzerler?: ListRow[] }

const tl = (n: number) => n.toLocaleString('tr-TR')
// Site kökü adaptörden gelir; panelin hangi sitede çalıştığını bilmesi gerekmiyor.
const mutlakUrl = (u: string | null, kok: string) => !u ? '#' : /^https?:\/\//.test(u) ? u : `${kok}${u}`

const HATA_METNI: Record<string, string> = {
  anahtarYok: 'Analiz için kendi Gemini API anahtarını girmen gerekiyor — ücretsiz.',
  anahtarSorunu: 'Anahtarın kabul edilmedi. Google AI Studio’da geçerli ve kotasının dolmamış olduğunu kontrol et.',
  hizLimiti: 'Google anahtarın hız sınırına takıldı, biraz sonra tekrar dene.',
  ag: 'Google’a ulaşılamadı.', ai: 'Analiz üretilemedi.'
}

const KM_ETIKET: Record<string, string> = {
  'cok-dusuk': 'Şüpheli Düşük', dusuk: 'Düşük KM', normal: 'Normal KM',
  yuksek: 'Yüksek KM', 'cok-yuksek': 'Çok Yüksek KM'
}
const KM_RENK: Record<string, 'yesil' | 'sari' | 'kirmizi'> = {
  'cok-dusuk': 'kirmizi', dusuk: 'sari', normal: 'yesil', yuksek: 'sari', 'cok-yuksek': 'kirmizi'
}
const ONEM_ETIKET: Record<string, string> = { yuksek: 'Yüksek', orta: 'Orta', dusuk: 'Düşük' }
const ONEM_RENK: Record<string, string> = { yuksek: 'kirmizi', orta: 'sari', dusuk: 'notr' }

// Küçültme salt görsel bir DOM toggle'ı — preact state/re-render gerektirmiyor.
function govdeGizleGoster(e: MouseEvent) {
  const govde = (e.currentTarget as HTMLElement).closest('.panel')?.querySelector('[data-rol="govde"]') as HTMLElement | null
  if (govde) govde.style.display = govde.style.display === 'none' ? '' : 'none'
}

export function Panel({ durum, kok = 'https://www.sahibinden.com' }: { durum: PanelDurum; kok?: string }) {
  return (
    <div class="panel">
      <div class="ustBar">
        <span>İlan Analiz</span>
        <button class="kucult" data-rol="kucult" onClick={govdeGizleGoster}>─</button>
      </div>
      <div class="govde" data-rol="govde">
        {durum.asama === 'yukleniyor' && <div class="skeleton bolum" data-rol="skeleton" />}
        {durum.asama === 'okunamadi' && <div class="hata bolum">İlan bilgileri okunamadı.</div>}
        {durum.asama === 'hata' && (
          <div class="hata bolum">
            {HATA_METNI[durum.mesaj] ?? `Bir sorun oluştu (${durum.mesaj}).`}
            {durum.mesaj === 'anahtarYok' || durum.mesaj === 'anahtarSorunu'
              ? <AnahtarCagrisi />
              : <div><button class="tekrar" data-rol="tekrar" onClick={durum.tekrar}>Tekrar dene</button></div>}
          </div>
        )}
        {durum.asama === 'hazir' && <Sonuc s={durum.sonuc} alternatifler={durum.alternatifler} benzerler={durum.benzerler} kok={kok} />}
      </div>
    </div>
  )
}

// Anahtar yoksa panelin tek işi yolu göstermek. Uzantı ücretsiz; kurulum tek adım.
function AnahtarCagrisi() {
  return (
    <div data-rol="anahtar-cagri">
      <button class="yukseltDugme" data-rol="anahtar-ac"
        onClick={() => tarayici.runtime.sendMessage({ tip: 'popupAc' })}>Anahtarı gir</button>
      <div class="yukseltIpucu">
        Uzantı ücretsiz. Analizi kendi Google Gemini anahtarınla üretiyorsun; anahtar
        yalnız senin tarayıcında durur. Tarayıcı çubuğundaki uzantı simgesinden de açabilirsin.
      </div>
    </div>
  )
}

function Sonuc({ s, alternatifler, benzerler, kok }: { s: AnalysisResult; alternatifler?: Alternatif[]; benzerler?: ListRow[]; kok: string }) {
  const renk = skorRenk(s.skor)
  return (
    <>
      <div class="bolum skorBolum">
        <div class={`skorKutu skor-${renk}`}>
          <span class="skorSayi">{s.skor.toFixed(1)}</span>
          <span class="skorAlt">10 üzerinden</span>
        </div>
        <div class="skorSag">
          <div class="durumEtiket">{s.durumEtiketi}</div>
          <div>
            <div class="skorBarZemin"><span class={`skorBarDolu skor-${renk}`} style={{ width: `${s.skor * 10}%` }} /></div>
            <div class="skorOlcek"><span>0</span><span>5</span><span>10</span></div>
          </div>
        </div>
      </div>

      {s.chipler.length > 0 && (
        <div class="bolum" data-rol="chip-bolum">
          <div class="chipler">{s.chipler.map(c => <span class="chip">{c}</span>)}</div>
        </div>
      )}

      {s.fiyatIstatistik && (
        <div class="bolum">
          <div class="mikro">Fiyat Konumu</div>
          <div class="slider" data-rol="slider"><span class="isaret" style={{ left: `${s.fiyatIstatistik.yuzdelik}%` }} /></div>
          <div class="sliderYazi"><span>Ucuz</span><span>Piyasa</span><span>Pahalı</span></div>
          <div class="medyanSatir">Medyan <b>{tl(s.fiyatIstatistik.medyan)} TL</b> · {s.fiyatIstatistik.n} benzer ilan</div>
          {s.pazarlikHedefi != null && (
            <div class="pazarlik">
              <div class="pazarlikEtiket">Pazarlık hedefi</div>
              <div class="pazarlikDeger">{tl(s.pazarlikHedefi)} TL</div>
            </div>
          )}
          {benzerler != null && benzerler.length > 0 && (
            <details class="benzerAcilir" data-rol="benzer-bolum">
              <summary class="benzerOzet">Karşılaştırılan {benzerler.length} ilanı gör</summary>
              <div class="benzerListe">
                {[...benzerler]
                  .sort((a, b) => (a.fiyat?.tutar ?? 0) - (b.fiyat?.tutar ?? 0))
                  .map(b => (
                    <a class="benzerSatir" href={mutlakUrl(b.url, kok)} target="_blank" rel="noopener noreferrer">
                      <span class="benzerBaslik">{b.baslik ?? 'İlan'}</span>
                      <span class="benzerDetay">
                        {[b.yil, b.km != null ? `${Math.round(b.km / 1000)} bin km` : null,
                          b.fiyat ? `${tl(b.fiyat.tutar)} TL` : null].filter(Boolean).join(' · ')}
                      </span>
                    </a>
                  ))}
              </div>
            </details>
          )}
        </div>
      )}

      {s.kmDurum && (
        <div class="bolum" data-rol="km-bolum">
          <div class="mikro">Kilometre</div>
          <div class="kmSatir"><span class={`rozet rozet-${KM_RENK[s.kmDurum.etiket]}`}>{KM_ETIKET[s.kmDurum.etiket]}</span></div>
          <div class="kmYorum">{s.kmDurum.yorum}</div>
        </div>
      )}

      {s.bayraklar.length > 0 && (
        <div class="bolum">
          <div class="mikro">Uyarılar</div>
          {s.bayraklar.map(b => <div class={`uyari uyari-${b.tip}`}>{b.metin}</div>)}
        </div>
      )}

      {s.kronikSorunlar.length > 0 && (
        <div class="bolum" data-rol="kronik-bolum">
          <div class="mikro">Bu Modelde Bilinen Sorunlar</div>
          {s.kronikSorunlar.slice(0, 5).map(k => (
            <div class="kronik">
              <div class="kronikBas">
                <span class="kronikBaslik">{k.baslik}</span>
                <span class={`rozet rozet-${ONEM_RENK[k.onem]}`}>{ONEM_ETIKET[k.onem]}</span>
              </div>
              <div class="kronikAcik">{k.aciklama}</div>
            </div>
          ))}
        </div>
      )}

      {(s.avantajlar.length > 0 || s.dezavantajlar.length > 0) && (
        <div class="bolum">
          {s.avantajlar.length > 0 && (
            <div class="liste">
              <div class="listeBas arti">Artılar</div>
              {s.avantajlar.map(a => <div class="madde"><span class="isaretci">+</span><span>{a}</span></div>)}
            </div>
          )}
          {s.dezavantajlar.length > 0 && (
            <div class="liste">
              <div class="listeBas eksi">Eksiler</div>
              {s.dezavantajlar.map(d => <div class="madde"><span class="isaretci">−</span><span>{d}</span></div>)}
            </div>
          )}
        </div>
      )}

      {/* Bölüm YALNIZ gerçekten alternatif varsa çıkar. Eskiden karşılaştırma varsa boş
          durumda da çıkıp "daha iyi seçenek çıkmadı" yazıyordu; alternatif üretimi
          kapatıldığından bu cümle hiç aramadığımız bir şey hakkında iddia olurdu. */}
      {(alternatifler?.length ?? 0) > 0 && (
        <div class="bolum" data-rol="alternatif-bolum">
          <div class="mikro">Daha İyi Alternatifler</div>
          {(alternatifler ?? []).slice(0, 3).map(a => (
            <a class="altSatir" href={mutlakUrl(a.satir.url, kok)} target="_blank" rel="noopener noreferrer">
              <div class="altBaslik">{a.satir.baslik ?? '—'}</div>
              <div class="altDetay">
                {a.satir.yil ?? '—'} · {a.satir.km != null ? Math.round(a.satir.km / 1000).toLocaleString('tr-TR') : '—'} bin km · {a.satir.fiyat?.tutar != null ? tl(a.satir.fiyat.tutar) : '—'} TL
              </div>
              <div class="altGerekce">{a.gerekce}</div>
            </a>
          ))}
        </div>
      )}

      <div class="bolum">
        <div class="mikro">Değerlendirme</div>
        <div class="ozet">{s.ozet} {s.fiyatYorumu}</div>
      </div>
    </>
  )
}
