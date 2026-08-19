import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { GIZLILIK_HTML } from './gizlilik'

// Backend'in TEK işi kaldı: gizlilik politikası sayfasını sunmak. Mağaza politikası
// yayınlanmış bir gizlilik URL'i zorunlu kılıyor, o yüzden bu sayfa duruyor.
//
// Analiz, kota, hesap ve ödeme akışlarının tamamı kalktı:
//   · varsayılan model WebGPU ile cihazda, isteğe bağlı Gemini kullanıcı anahtarıyla çalışıyor
//   · ilan içeriği hiçbir sistemimize uğramıyor
//   · veritabanı yok — saklanacak veri kalmadı
// Bu sayfayı statik bir barındırıcıya taşıyıp sunucuyu tamamen kapatmak mümkün;
// tek engel değil, tercih meselesi.

export function makeApp(): Hono {
  const app = new Hono()
  // no-store: sürüm damgası önbelleğe alınınca eski kodu gösteriyordu (canlıda yaşandı)
  app.get('/health', c => {
    c.header('Cache-Control', 'no-store, max-age=0')
    return c.json({ ok: true, surum: process.env.SURUM ?? 'yerel' })
  })
  app.get('/gizlilik', c => c.html(GIZLILIK_HTML))
  return app
}

if (process.env.NODE_ENV !== 'test') {
  const port = parseInt(process.env.PORT ?? '3000', 10)
  serve({ fetch: makeApp().fetch, port })
  console.log(`dinliyor :${port}`)
}
