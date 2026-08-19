import { build } from 'esbuild'
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

// pnpm build   → geliştirme paketi (okunur çıktı)
// pnpm paket   → dağıtım paketi (minify + zip)
// Sunucu ve Supabase bağımlılığı KALKTI: yerel model veya kullanıcının Gemini anahtarı
// doğrudan tarayıcıda çalışır. Derleme gizli değer istemez; paket herkesin elinde aynı.
const paketle = process.env.PAKET === '1'
// HEDEF=firefox: Firefox MV3'te arka plan service worker DEĞİL, event page.
// Ayrıca imzalama için gecko.id zorunlu. İki mağazanın manifesti aynı olamıyor.
const firefox = process.env.HEDEF === 'firefox'
const GECKO_ID = process.env.GECKO_ID ?? 'ilan-analiz@paffstudios.com'


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
  jsx: 'automatic', jsxImportSource: 'preact'
}
await build({ ...ortak, entryPoints: ['src/content.tsx'], format: 'iife' })
await build({
  ...ortak,
  entryPoints: ['src/sw.ts', 'src/popup.tsx'],
  format: 'esm',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]'
})

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
writeFileSync(`${CIKTI}/manifest.json`, JSON.stringify(manifest, null, 2))

cpSync('public/popup.html', `${CIKTI}/popup.html`)
mkdirSync(`${CIKTI}/icons`, { recursive: true })
cpSync('public/icons', `${CIKTI}/icons`, { recursive: true })
mkdirSync(`${CIKTI}/model-libs`, { recursive: true })
cpSync('public/model-libs', `${CIKTI}/model-libs`, { recursive: true })

if (paketle) {
  const zip = `ilan-analiz${firefox ? '-firefox' : ''}-${manifest.version}.zip`
  rmSync(zip, { force: true })
  // Chrome Web Store zip'i dist içeriğini KÖKTE bekler, dist/ klasörü sarmalı olarak değil.
  // -X: macOS'un __MACOSX / .DS_Store gibi ekstra girdilerini dışarıda bırak.
  execFileSync('zip', ['-r', '-X', `../${zip}`, '.', '-x', '.*'], { cwd: CIKTI, stdio: 'inherit' })
  console.log(`\n${zip} hazır — siteler: ${siteEslesme.length}`)
} else {
  console.log(`${CIKTI}/ hazır — ${firefox ? 'FIREFOX' : 'chrome'} — ${siteEslesme.length} site`)
}
