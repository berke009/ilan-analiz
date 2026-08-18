import { useState, useEffect } from 'preact/hooks'
import {
  anahtarGetir, anahtarKaydet, anahtarSil, anahtarDogrula, anahtarMaskele, ANAHTAR_HATA
} from '../anahtar'

const STUDIO = 'https://aistudio.google.com/apikey'

type Durum =
  | { ad: 'yukleniyor' }
  | { ad: 'yok'; hata?: string; bekliyor?: boolean }
  | { ad: 'var'; anahtar: string }

export function Anahtar() {
  const [durum, setDurum] = useState<Durum>({ ad: 'yukleniyor' })

  useEffect(() => {
    anahtarGetir().then(a => setDurum(a ? { ad: 'var', anahtar: a } : { ad: 'yok' }))
  }, [])

  if (durum.ad === 'yukleniyor') return <div class="bekle">Yükleniyor…</div>
  if (durum.ad === 'var') return <Kayitli anahtar={durum.anahtar} sil={async () => {
    await anahtarSil(); setDurum({ ad: 'yok' })
  }} />
  return <Form durum={durum} setDurum={setDurum} />
}

function Form({ durum, setDurum }: { durum: Extract<Durum, { ad: 'yok' }>; setDurum: (d: Durum) => void }) {
  const gonder = async (e: Event) => {
    e.preventDefault()
    const alan = (e.target as HTMLFormElement).elements.namedItem('anahtar') as HTMLInputElement
    const deger = alan.value.trim()
    setDurum({ ...durum, bekliyor: true, hata: undefined })
    // Kaydetmeden ÖNCE doğrula: geçersiz anahtar kaydedilirse kullanıcı her ilanda
    // hata görür ve sebebini burada değil orada aramaya başlar.
    const s = await anahtarDogrula(deger)
    if (!s.ok) { setDurum({ ...durum, bekliyor: false, hata: s.hata }); return }
    await anahtarKaydet(deger)
    setDurum({ ad: 'var', anahtar: deger })
  }

  return (
    <form class="form" onSubmit={gonder}>
      <div class="bilgi">
        Uzantı tamamen ücretsiz. Analizi kendi Google Gemini anahtarınla üretiyorsun —
        anahtar yalnız senin tarayıcında durur, bize hiç gönderilmez.
      </div>

      <label class="etiket" for="anahtar">Gemini API anahtarı</label>
      <input class="giris" id="anahtar" name="anahtar" type="password" autocomplete="off"
        spellcheck={false} placeholder="AIza…" required />

      {durum.hata && <div class="hataKutu" role="alert">{ANAHTAR_HATA[durum.hata] ?? 'Bir sorun oluştu.'}</div>}

      <button class="anaDugme" type="submit" disabled={durum.bekliyor}>
        {durum.bekliyor ? 'Doğrulanıyor…' : 'Kaydet ve doğrula'}
      </button>

      <p class="ipucu">
        Anahtarı <a href={STUDIO} target="_blank" rel="noopener noreferrer">Google AI Studio</a>'dan
        ücretsiz alabilirsin: giriş yap → «Create API key» → kopyala. Ücretsiz katman günlük
        kullanım için fazlasıyla yeter.
      </p>
    </form>
  )
}

function Kayitli({ anahtar, sil }: { anahtar: string; sil: () => void }) {
  const [soruyor, setSoruyor] = useState(false)
  return (
    <div class="kart">
      <div class="ustSatir">
        <span class="eposta" title="Anahtarın tamamı gösterilmez">{anahtarMaskele(anahtar)}</span>
        <span class="plan plan-premium">Hazır</span>
      </div>

      <div class="bilgi">
        Analiz açık. İlan sayfalarında panel kendiliğinden çıkar; maliyet kendi Google
        hesabından işlenir, günlük bir sınır koymuyoruz.
      </div>

      {soruyor ? (
        <>
          <div class="hataKutu">Anahtar silinecek ve analizler duracak. Emin misin?</div>
          <button class="anaDugme" type="button" onClick={sil}>Evet, sil</button>
          <button class="ikinciDugme" type="button" onClick={() => setSoruyor(false)}>Vazgeç</button>
        </>
      ) : (
        <button class="ikinciDugme" type="button" onClick={() => setSoruyor(true)}>Anahtarı sil</button>
      )}
    </div>
  )
}
