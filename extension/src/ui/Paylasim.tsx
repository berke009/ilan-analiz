import { useState, useEffect } from 'preact/hooks'
import { PAYLASIM_KOK, paylasimAcikMi, paylasimAc, paylasimKapat } from '../paylasim'

// Paylaşılan önbellek rıza kutusu.
//
// Metin İKİ YÖNÜ DE söylüyor: ne alıyorsun, ne veriyorsun. "Önbelleği aç" gibi tek
// yönlü bir çerçeve, kullanıcının kendi analizlerinin başkalarına gösterileceğini
// gizlerdi — bu özelliğin tamamı o karşılıklılığa dayanıyor.
//
// PAYLASIM_KOK boşsa (varsayılan derleme) bileşen HİÇ ÇİZİLMEZ: olmayan bir
// özelliğin kapalı anahtarını göstermek kullanıcıya yanlış bilgi vermek olur.

type Durum = { ad: 'yukleniyor' } | { ad: 'kapali'; reddedildi?: boolean } | { ad: 'acik' }

export function Paylasim() {
  const [durum, setDurum] = useState<Durum>({ ad: 'yukleniyor' })
  const [detay, setDetay] = useState(false)

  useEffect(() => {
    if (!PAYLASIM_KOK) return
    // GERÇEK kapıya bakılıyor: tercih + izin. Yalnız izne bakmak, tercihi
    // yazılamamış bir kurulumda "Açık" gösterip hiçbir istek atmamak demekti.
    // İzin tarayıcı ayarlarından geri alınmışsa paylasimAyari bayrağı da indiriyor.
    paylasimAcikMi().then(v => setDurum(v ? { ad: 'acik' } : { ad: 'kapali' }))
  }, [])

  if (!PAYLASIM_KOK) return null
  if (durum.ad === 'yukleniyor') return null

  const ac = async () => setDurum(await paylasimAc() ? { ad: 'acik' } : { ad: 'kapali', reddedildi: true })
  const kapat = async () => { await paylasimKapat(); setDurum({ ad: 'kapali' }) }

  return (
    <div class="paylasimBolum" data-rol="paylasim">
      <div class="ustSatir">
        <span class="paylasimBaslik">Paylaşılan önbellek</span>
        <span class={`plan ${durum.ad === 'acik' ? 'plan-premium' : ''}`}>
          {durum.ad === 'acik' ? 'Açık' : 'Kapalı'}
        </span>
      </div>

      {durum.ad === 'acik' ? (
        <>
          <div class="bilgi">
            Başka kullanıcıların ürettiği analizleri görüyorsun — o ilanlarda kendi
            anahtarın harcanmıyor. Karşılığında senin ürettiğin analizlerin metni
            aynı ilanı açanlara gösteriliyor.
          </div>
          <button class="ikinciDugme" type="button" data-rol="paylasim-kapat" onClick={kapat}>
            Paylaşımdan çık
          </button>
        </>
      ) : (
        <>
          <div class="bilgi">
            Katılırsan aynı ilanı senden önce analiz eden birinin sonucunu anında
            görürsün, kendi anahtarın harcanmaz. Karşılığında senin analizlerin de
            paylaşılır. Katılmak zorunda değilsin; uzantı kapalıyken de tam çalışır.
          </div>
          {durum.reddedildi && (
            <div class="hataKutu" role="alert">
              İzin verilmedi. Paylaşılan önbellek olmadan uzantı aynen çalışmaya devam eder.
            </div>
          )}
          <button class="anaDugme" type="button" data-rol="paylasim-ac" onClick={ac}>
            Paylaşıma katıl
          </button>
        </>
      )}

      <button class="baglantiDugme" type="button" data-rol="paylasim-detay"
        onClick={() => setDetay(d => !d)}>
        {detay ? 'Ayrıntıyı gizle' : 'Ne paylaşılıyor, ne paylaşılmıyor?'}
      </button>

      {detay && (
        <div class="paylasimDetay" data-rol="paylasim-detay-govde">
          <div class="paylasimListe">
            <div class="paylasimListeBas arti">Sunucuya giden</div>
            <div class="madde"><span class="isaretci">+</span><span>
              Analiz metni: skor, özet, artı/eksi maddeleri, uyarılar
            </span></div>
            <div class="madde"><span class="isaretci">+</span><span>
              İlan numarası ve fiyattan üretilen geri çevrilemez bir özet (SHA-256)
            </span></div>
          </div>
          <div class="paylasimListe">
            <div class="paylasimListeBas eksi">Sunucuya GİTMEYEN</div>
            <div class="madde"><span class="isaretci">−</span><span>API anahtarın</span></div>
            <div class="madde"><span class="isaretci">−</span><span>
              İlanın adresi, başlığı ve satıcının yazdığı açıklama
            </span></div>
            <div class="madde"><span class="isaretci">−</span><span>
              Kim olduğun: hesap yok, e-posta yok, çerez yok
            </span></div>
          </div>
          <p class="ipucu">
            Fiyat konumu, kilometre değerlendirmesi ve pazarlık hedefi paylaşılan
            metinden GELMEZ; her zaman senin kendi verinle, senin cihazında hesaplanır.
            Paylaşılan kayıtlar 24 saat sonra silinir. Çıktığında adres izni geri alınır.
          </p>
        </div>
      )}
    </div>
  )
}
