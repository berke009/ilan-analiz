import { build } from 'esbuild'
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

// pnpm build   → geliştirme paketi (okunur çıktı)
// pnpm paket   → dağıtım paketi (minify + zip)
// Sunucu ve Supabase bağımlılığı KALKTI: analiz tarayıcıda, anahtar kullanıcının.
// Derleme artık hiçbir gizli değer istemiyor — paket herkesin elinde aynı.
const paketle = process.env.PAKET === '1'
// HEDEF=firefox: Firefox MV3'te arka plan service worker DEĞİL, event page.
// Ayrıca imzalama için gecko.id zorunlu. İki mağazanın manifesti aynı olamıyor.
const firefox = process.env.HEDEF === 'firefox'
const GECKO_ID = process.env.GECKO_ID ?? 'ilan-analiz@paffstudios.com'

// PAYLASIM_KOK: paylaşılan analiz önbelleğini sunan adres (örn. https://onbellek.ornek.com).
// VERİLMEZSE ÖZELLİK PAKETTE HİÇ YOKTUR: adres sabiti boş kalır, kod ölü daldır ve
// optional_host_permissions listesi manifestten tamamen düşer — yani derlenen uzantının
// bizim sunucumuza çıkma yetkisi teknik olarak bulunmaz. Kendi sunucusunu kuran biri
// kendi adresiyle derleyip kendi kullanıcı kitlesini oluşturabilir.
const PAYLASIM_KOK = (process.env.PAYLASIM_KOK ?? '').replace(/\/+$/, '')
if (PAYLASIM_KOK && !/^https:\/\//.test(PAYLASIM_KOK)) {
  // http:// bir paket, mağaza incelemesinde doğrudan kırmızı bayrak; ayrıca analiz
  // metni açık ağda taşınırdı. Sessizce derlemektense burada dur.
  throw new Error(`PAYLASIM_KOK https:// ile başlamalı: ${PAYLASIM_KOK}`)
}


// host_permissions'a yalnız gerçekten kullanılan origin girsin: mağaza incelemesi
// gereksiz geniş izinleri sorguluyor, localhost'lu bir paket ise doğrudan kırmızı bayrak.

// Chrome ve Firefox AYRI klasöre derlenir. Tek klasöre yazmak sinsi bir tuzaktı:
// arka arkaya iki hedef paketlendiğinde dist/ son hedefin derlemesiyle kalıyor ve
// oradan "chrome://extensions > paketlenmemiş yükle" yapan kişi Firefox manifestini
// yüklüyordu (background.scripts ↔ service_worker). Uzantı sessizce yükleniyor ama
// arka plan hiç çalışmıyor: analiz istekleri cevapsız kalıyor. Canlıda yaşandı.
const CIKTI = firefox ? 'dist-firefox' : 'dist'
rmSync(CIKTI, { recursive: true, force: true })

const ortak = {
  bundle: true, outdir: CIKTI, minify: paketle, target: 'chrome120',
  jsx: 'automatic', jsxImportSource: 'preact',
  // Adres derleme zamanı sabiti: çalışma zamanında değiştirilebilir bir ayar olsaydı
  // uzantı, ele geçen bir depo değeriyle başka bir sunucuya konuşabilir hâle gelirdi.
  define: { __PAYLASIM_KOK__: JSON.stringify(PAYLASIM_KOK) }
}
await build({ ...ortak, entryPoints: ['src/content.tsx'], format: 'iife' })
await build({ ...ortak, entryPoints: ['src/sw.ts'], format: 'esm' })
await build({ ...ortak, entryPoints: ['src/popup.tsx'], format: 'iife' })

const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'))
if (firefox) {
  // service_worker Firefox'ta desteklenmiyor (web-ext lint: MANIFEST_FIELD_UNSUPPORTED)
  manifest.background = { scripts: ['sw.js'], type: 'module' }
  // MV3'te kimlik zorunlu (web-ext lint: EXTENSION_ID_REQUIRED)
  manifest.browser_specific_settings = {
    gecko: {
      id: GECKO_ID,
      strict_min_version: '128.0',
      // 3 Kasım 2025'ten beri zorunlu. required'a konan veriyi kullanıcı REDDEDEMEZ —
      // uzantıyı hiç kullanamaz. O yüzden yalnız çekirdek işlev için şart olan orada.
      data_collection_permissions: {
        // Tek beyan bu: ilan içeriği analizin girdisi. Hesap sistemi kaldırıldı,
        // e-posta/parola hiç istenmiyor — optional'da PII beyan etmek FAZLA beyan olur.
        required: ['websiteContent']
      }
    }
  }
}

// Desteklenen siteler TEK kaynaktan: src/siteler/kayit.json. Manifest'i elle
// güncellemek, çalışma zamanı adaptörü ile manifest'in sessizce ayrışmasına yol
// açardı — uzantı ya hiç çalışmayan bir sitede izin ister ya da izni olmayan bir
// sitede çalışmaya çalışır. İkisi de mağaza incelemesinde sorun.
const siteler = JSON.parse(readFileSync('src/siteler/kayit.json', 'utf8'))
const siteEslesme = siteler.flatMap(s => s.eslesenler)
manifest.content_scripts = manifest.content_scripts.map(cs => ({ ...cs, matches: siteEslesme }))
manifest.host_permissions = [
  ...siteEslesme,
  ...manifest.host_permissions.filter(h => !siteEslesme.includes(h) && !h.includes('sahibinden'))
]
// Paylaşılan önbellek izni OPSİYONEL: kurulumda istenmez, kullanıcı özelliği
// açtığında popup'tan istenir (permissions.request). Kullanıcı onaylamadan tarayıcı
// bu adrese çıkışı ENGELLER — kodda bir hata olsa bile istek kurulamaz.
if (PAYLASIM_KOK) manifest.optional_host_permissions = [`${PAYLASIM_KOK}/*`]
else delete manifest.optional_host_permissions

writeFileSync(`${CIKTI}/manifest.json`, JSON.stringify(manifest, null, 2))

cpSync('public/popup.html', `${CIKTI}/popup.html`)
mkdirSync(`${CIKTI}/icons`, { recursive: true })
cpSync('public/icons', `${CIKTI}/icons`, { recursive: true })

if (paketle) {
  const zip = `ilan-analiz${firefox ? '-firefox' : ''}-${manifest.version}.zip`
  rmSync(zip, { force: true })
  // Chrome Web Store zip'i dist içeriğini KÖKTE bekler, dist/ klasörü sarmalı olarak değil.
  // -X: macOS'un __MACOSX / .DS_Store gibi ekstra girdilerini dışarıda bırak.
  execFileSync('zip', ['-r', '-X', `../${zip}`, '.', '-x', '.*'], { cwd: CIKTI, stdio: 'inherit' })
  console.log(`\n${zip} hazır — siteler: ${siteEslesme.length}`)
} else {
  console.log(`${CIKTI}/ hazır — ${firefox ? 'FIREFOX' : 'chrome'} — ${siteEslesme.length} site — paylaşılan önbellek: ${PAYLASIM_KOK || 'kapalı'}`)
}
