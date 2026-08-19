import { useState, useEffect } from 'preact/hooks'
import {
  anahtarGetir, anahtarKaydet, anahtarSil, anahtarDogrula, anahtarMaskele, ANAHTAR_HATA
} from '../anahtar'
import { aiSaglayiciGetir, aiSaglayiciKaydet } from '../aiAyar'
import {
  YEREL_MODEL_ADI, YEREL_MODEL_BOYUTU, webGpuDestekliMi, yerelModelHazirMi, yerelModeliHazirla
} from '../yerelAi'

const STUDIO = 'https://aistudio.google.com/apikey'

type Durum =
  | { ad: 'yukleniyor' }
  | {
      ad: 'yerel'; webgpu: boolean; hazir: boolean; indiriyor?: boolean;
      ilerleme?: number; hata?: string
    }
  | { ad: 'gemini-yok'; hata?: string; bekliyor?: boolean }
  | { ad: 'gemini-var'; anahtar: string }

async function yerelDurumuGetir(): Promise<Extract<Durum, { ad: 'yerel' }>> {
  const webgpu = webGpuDestekliMi()
  if (!webgpu) return { ad: 'yerel', webgpu, hazir: false }
  try {
    return { ad: 'yerel', webgpu, hazir: await yerelModelHazirMi() }
  } catch {
    return { ad: 'yerel', webgpu, hazir: false, hata: 'Model önbelleği okunamadı.' }
  }
}

export function AiAyarlari() {
  const [durum, setDurum] = useState<Durum>({ ad: 'yukleniyor' })

  useEffect(() => {
    void (async () => {
      const saglayici = await aiSaglayiciGetir()
      if (saglayici === 'yerel') {
        setDurum(await yerelDurumuGetir())
        return
      }
      const anahtar = await anahtarGetir()
      setDurum(anahtar ? { ad: 'gemini-var', anahtar } : { ad: 'gemini-yok' })
    })()
  }, [])

  const yereleGec = async () => {
    await aiSaglayiciKaydet('yerel')
    setDurum(await yerelDurumuGetir())
  }
  const geminiyeGec = async () => {
    await aiSaglayiciKaydet('gemini')
    const anahtar = await anahtarGetir()
    setDurum(anahtar ? { ad: 'gemini-var', anahtar } : { ad: 'gemini-yok' })
  }

  if (durum.ad === 'yukleniyor') return <div class="bekle">Yükleniyor…</div>
  if (durum.ad === 'yerel') return (
    <YerelKart durum={durum} setDurum={setDurum} geminiyeGec={geminiyeGec} />
  )
  if (durum.ad === 'gemini-var') return (
    <GeminiKayitli anahtar={durum.anahtar} yereleGec={yereleGec} sil={async () => {
      await anahtarSil()
      setDurum({ ad: 'gemini-yok' })
    }} />
  )
  return <GeminiForm durum={durum} setDurum={setDurum} yereleGec={yereleGec} />
}

function YerelKart({
  durum, setDurum, geminiyeGec
}: {
  durum: Extract<Durum, { ad: 'yerel' }>
  setDurum: (durum: Durum | ((onceki: Durum) => Durum)) => void
  geminiyeGec: () => void
}) {
  const indir = async () => {
    await aiSaglayiciKaydet('yerel')
    setDurum({ ...durum, indiriyor: true, hata: undefined, ilerleme: 0 })
    try {
      await yerelModeliHazirla(rapor => setDurum(onceki =>
        onceki.ad === 'yerel'
          ? { ...onceki, indiriyor: true, ilerleme: rapor.progress, hata: undefined }
          : onceki
      ))
      setDurum({ ad: 'yerel', webgpu: true, hazir: true })
    } catch (hata) {
      console.error('[YEREL MODEL]', hata)
      const mesaj = String(hata instanceof Error ? hata.message : hata)
      setDurum({
        ad: 'yerel', webgpu: durum.webgpu, hazir: false,
        hata: mesaj.includes('WEBGPU_YOK')
          ? 'Bu cihazda WebGPU kullanılamıyor.'
          : 'Model indirilemedi. Bağlantını kontrol edip tekrar dene.'
      })
    }
  }

  return (
    <div class="kart">
      <div class="ustSatir">
        <span class="eposta">{YEREL_MODEL_ADI}</span>
        <span class={`plan ${durum.hazir ? 'plan-premium' : ''}`}>
          {durum.hazir ? 'Hazır' : 'Yerel'}
        </span>
      </div>
      <div class="bilgi">
        İlan cihazında analiz edilir; metin dışarı gönderilmez ve API anahtarı gerekmez.
      </div>

      {!durum.webgpu && (
        <div class="hataKutu" role="alert">
          Bu cihazda WebGPU kullanılamıyor. Gemini seçeneğini kullanabilirsin.
        </div>
      )}
      {durum.hata && <div class="hataKutu" role="alert">{durum.hata}</div>}

      {durum.indiriyor && (
        <div class="indirme" aria-live="polite">
          <div class="indirmeSatir">
            <span>Model hazırlanıyor</span>
            <b>%{Math.round((durum.ilerleme ?? 0) * 100)}</b>
          </div>
          <div class="indirmeCubuk"><span style={{ width: `${Math.round((durum.ilerleme ?? 0) * 100)}%` }} /></div>
          <p class="ipucu">İndirme bitene kadar bu pencereyi açık tut.</p>
        </div>
      )}

      {!durum.hazir && durum.webgpu && !durum.indiriyor && (
        <>
          <button class="anaDugme" type="button" onClick={indir}>Yerel modeli indir</button>
          <p class="ipucu">
            İlk kurulum {YEREL_MODEL_BOYUTU}; model daha sonra tarayıcı önbelleğinden açılır.
          </p>
        </>
      )}
      {durum.hazir && (
        <p class="ipucu">Model cihazında hazır. İlan sayfasını açtığında analiz otomatik başlar.</p>
      )}
      <button class="ikinciDugme" type="button" onClick={geminiyeGec}>Gemini kullan</button>
    </div>
  )
}

function GeminiForm({
  durum, setDurum, yereleGec
}: {
  durum: Extract<Durum, { ad: 'gemini-yok' }>
  setDurum: (durum: Durum) => void
  yereleGec: () => void
}) {
  const gonder = async (e: Event) => {
    e.preventDefault()
    const alan = (e.target as HTMLFormElement).elements.namedItem('anahtar') as HTMLInputElement
    const deger = alan.value.trim()
    setDurum({ ...durum, bekliyor: true, hata: undefined })
    const sonuc = await anahtarDogrula(deger)
    if (!sonuc.ok) {
      setDurum({ ...durum, bekliyor: false, hata: sonuc.hata })
      return
    }
    await anahtarKaydet(deger)
    await aiSaglayiciKaydet('gemini')
    setDurum({ ad: 'gemini-var', anahtar: deger })
  }

  return (
    <form class="form" onSubmit={gonder}>
      <div class="bilgi">
        Gemini analizi kendi API anahtarınla üretir. İlan metni doğrudan Google’a gider;
        anahtar bize gönderilmez.
      </div>
      <label class="etiket" for="anahtar">Gemini API anahtarı</label>
      <input class="giris" id="anahtar" name="anahtar" type="password" autocomplete="off"
        spellcheck={false} placeholder="AIza…" required />
      {durum.hata && (
        <div class="hataKutu" role="alert">{ANAHTAR_HATA[durum.hata] ?? 'Bir sorun oluştu.'}</div>
      )}
      <button class="anaDugme" type="submit" disabled={durum.bekliyor}>
        {durum.bekliyor ? 'Doğrulanıyor…' : 'Kaydet ve Gemini’yi kullan'}
      </button>
      <p class="ipucu">
        Anahtarı <a href={STUDIO} target="_blank" rel="noopener noreferrer">Google AI Studio</a>'dan
        alabilirsin: giriş yap → «Create API key» → kopyala.
      </p>
      <button class="ikinciDugme" type="button" onClick={yereleGec}>Yerel AI kullan</button>
    </form>
  )
}

function GeminiKayitli({
  anahtar, sil, yereleGec
}: { anahtar: string; sil: () => void; yereleGec: () => void }) {
  const [soruyor, setSoruyor] = useState(false)
  return (
    <div class="kart">
      <div class="ustSatir">
        <span class="eposta" title="Anahtarın tamamı gösterilmez">{anahtarMaskele(anahtar)}</span>
        <span class="plan plan-premium">Gemini</span>
      </div>
      <div class="bilgi">
        Analiz açık. İlan metni doğrudan Google’a gönderilir; anahtar yalnız uzantı deposunda durur.
      </div>
      {soruyor ? (
        <>
          <div class="hataKutu">Gemini anahtarı silinecek. Emin misin?</div>
          <button class="anaDugme" type="button" onClick={sil}>Evet, sil</button>
          <button class="ikinciDugme" type="button" onClick={() => setSoruyor(false)}>Vazgeç</button>
        </>
      ) : (
        <button class="ikinciDugme" type="button" onClick={() => setSoruyor(true)}>Anahtarı sil</button>
      )}
      <button class="ikinciDugme" type="button" onClick={yereleGec}>Yerel AI’ya geç</button>
    </div>
  )
}
