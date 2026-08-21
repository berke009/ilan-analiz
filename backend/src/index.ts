import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { GIZLILIK_HTML } from './gizlilik'
import { onbellekRotalari } from './onbellek'
import { ayarOku, type Ayar } from './yapilandirma'
import { bellekDepo, toleransli, valkeyDepo, type Depo } from './depo'

// Backend iki iş yapıyor ve İKİNCİSİ VARSAYILAN OLARAK KAPALI:
//
//   1. Gizlilik politikası sayfasını sunmak (mağaza listelemesi için zorunlu).
//   2. PAYLASIM_ACIK=1 ise, rıza veren kullanıcıların paylaşılan analiz önbelleği.
//
// İkincisi açıkken bile sunucu ANALİZ ÜRETMİYOR: model çağrısı, kota, hesap, ödeme
// yok. Kullanıcının API anahtarı buraya HİÇ uğramıyor — uzantı Gemini'ye doğrudan
// çıkıyor, sonucun yalnız metin kısmını buraya bırakıyor (cache-aside).
//
// Bu depoyu klonlayıp hiçbir şey ayarlamadan çalıştıran biri, önbellek katmanı hiç
// yokmuş gibi bir sunucu alır. Rotalar 404 döndürmüyor — hiç KURULMUYOR.

export function makeApp(ayar: Ayar = ayarOku(), depo?: Depo): Hono {
  const app = new Hono()
  // no-store: sürüm damgası önbelleğe alınınca eski kodu gösteriyordu (canlıda yaşandı)
  app.get('/health', c => {
    c.header('Cache-Control', 'no-store, max-age=0')
    return c.json({ ok: true, surum: process.env.SURUM ?? 'yerel', paylasim: ayar.acik })
  })
  app.get('/gizlilik', c => c.html(GIZLILIK_HTML))
  if (ayar.acik) {
    // Depo verilmediyse bellek içi: tek süreçlik kurulum ve testler için. Üretimde
    // aşağıdaki önyükleme Valkey'i bağlayıp buraya geçiriyor.
    app.route('/v1', onbellekRotalari(depo ?? toleransli(bellekDepo()), ayar))
  }
  return app
}

// Önyükleme ayrı: Valkey bağlantısı asenkron, makeApp ise senkron kalmalı —
// testler uygulamayı sunucu ayağa kaldırmadan kurabiliyor (app.request).
async function depoKur(ayar: Ayar): Promise<Depo> {
  if (!ayar.valkeyUrl) {
    console.log('[DEPO] VALKEY_URL yok — bellek içi önbellek (süreç yeniden başlayınca sıfırlanır)')
    return toleransli(bellekDepo())
  }
  try {
    const d = await valkeyDepo(ayar.valkeyUrl)
    console.log('[DEPO] valkey bağlandı')
    return toleransli(d)
  } catch (e) {
    // Valkey yoksa GİZLİLİK SAYFASI YAYINDA KALMALI. Önyüklemede patlamak, mağaza
    // incelemesinin gördüğü tek URL'i bir önbellek arızası yüzünden düşürmek olurdu.
    console.log('[DEPO] valkey bağlanamadı, bellek içine düşülüyor:', String((e as Error)?.message ?? e).slice(0, 200))
    return toleransli(bellekDepo())
  }
}

if (process.env.NODE_ENV !== 'test') {
  const ayar = ayarOku()
  const port = parseInt(process.env.PORT ?? '3000', 10)
  // Varsayılan olarak YALNIZ LOOPBACK dinlenir. Sunucu Cloudflare Tunnel arkasında
  // duruyor ve tünel buraya localhost'tan bağlanıyor; dışarıya açık port yok.
  // 0.0.0.0'a bind etmek IP başlığını (cf-connecting-ip) uydurulabilir hâle
  // getirir ve IP limitini tamamen anlamsızlaştırır.
  const adres = process.env.BIND ?? '127.0.0.1'
  const baslat = async () => {
    const depo = ayar.acik ? await depoKur(ayar) : undefined
    serve({ fetch: makeApp(ayar, depo).fetch, port, hostname: adres })
    console.log(`dinliyor ${adres}:${port}${ayar.acik ? ' — paylaşılan önbellek AÇIK' : ''}`)
  }
  baslat()
}
