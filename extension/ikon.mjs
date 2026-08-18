// Uzantı ikonlarını üretir: node ikon.mjs → public/icons/icon{16,32,48,128}.png
//
// Bağımlılık yok; PNG'yi elle kodluyoruz (zlib Node'da zaten var). Amaç tek seferlik
// bir üretim adımı — çıktı public/icons altında commit'lenir, build sadece kopyalar.
//
// Tasarım: panelin sıcak-nötr koyu zemini + skor kadranı. 16px'te ayrıntı ölmesin diye
// tek bir kalın yay ve ibre var; renk panelin "iyi araç" yeşili.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const ZEMIN = [0x19, 0x16, 0x14]
const YAY = [0x4f, 0xb0, 0x6a]
const OLU = [0x35, 0x30, 0x2c] // yayın boş kalan kısmı
const IBRE = [0xf0, 0xec, 0xe7]

const AS = 4 // supersampling — kenarlar yumuşasın

// Yay: sol altta başlayıp sağ altta biten açık kadran (gösterge paneli hissi)
const BAS = Math.PI * 0.75
const BIT = Math.PI * 2.25
const DOLU = 0.72 // kadranın ne kadarı yeşil — "iyi" tarafta duran bir ibre

function ornekle(x, y, b) {
  const mrk = b / 2
  const dx = x - mrk, dy = y - mrk
  const uz = Math.hypot(dx, dy)

  // dış köşeleri yuvarlanmış kare zemin
  const r = b * 0.22
  const kx = Math.abs(dx) - (mrk - r), ky = Math.abs(dy) - (mrk - r)
  const koseUz = Math.hypot(Math.max(kx, 0), Math.max(ky, 0))
  if (koseUz > r) return null // saydam

  const yayR = b * 0.33
  const kalinlik = b * 0.13
  if (Math.abs(uz - yayR) <= kalinlik / 2) {
    // atan2(y, x) ekran koordinatında saat yönü; 0 = sağ
    let a = Math.atan2(dy, dx)
    if (a < BAS) a += Math.PI * 2
    if (a >= BAS && a <= BIT) {
      const t = (a - BAS) / (BIT - BAS)
      return t <= DOLU ? YAY : OLU
    }
  }

  // ibre: merkezden yayın dolu ucuna doğru kalın bir çizgi
  const aci = BAS + (BIT - BAS) * DOLU
  const ux = Math.cos(aci), uy = Math.sin(aci)
  const izd = dx * ux + dy * uy
  if (izd > 0 && izd < yayR - kalinlik * 0.55) {
    const dik = Math.abs(dx * -uy + dy * ux)
    if (dik <= b * 0.045) return IBRE
  }

  return ZEMIN
}

function pikseller(b) {
  const veri = Buffer.alloc(b * b * 4)
  for (let y = 0; y < b; y++) {
    for (let x = 0; x < b; x++) {
      let r = 0, g = 0, mavi = 0, a = 0
      for (let sy = 0; sy < AS; sy++) {
        for (let sx = 0; sx < AS; sx++) {
          const p = ornekle(x + (sx + 0.5) / AS, y + (sy + 0.5) / AS, b)
          if (p) { r += p[0]; g += p[1]; mavi += p[2]; a += 255 }
        }
      }
      const n = AS * AS
      const i = (y * b + x) * 4
      // saydam örnekler renge katılmasın diye alfa ağırlığıyla normalize et
      const dolu = a / 255
      veri[i] = dolu ? Math.round(r / dolu) : 0
      veri[i + 1] = dolu ? Math.round(g / dolu) : 0
      veri[i + 2] = dolu ? Math.round(mavi / dolu) : 0
      veri[i + 3] = Math.round(a / n)
    }
  }
  return veri
}

function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function parca(tip, govde) {
  const uzunluk = Buffer.alloc(4)
  uzunluk.writeUInt32BE(govde.length)
  const tipVeGovde = Buffer.concat([Buffer.from(tip, 'latin1'), govde])
  const kontrol = Buffer.alloc(4)
  kontrol.writeUInt32BE(crc32(tipVeGovde))
  return Buffer.concat([uzunluk, tipVeGovde, kontrol])
}

function png(b) {
  const veri = pikseller(b)
  // her satırın başına filtre baytı (0 = None)
  const satirli = Buffer.alloc(b * (b * 4 + 1))
  for (let y = 0; y < b; y++) {
    satirli[y * (b * 4 + 1)] = 0
    veri.copy(satirli, y * (b * 4 + 1) + 1, y * b * 4, (y + 1) * b * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(b, 0); ihdr.writeUInt32BE(b, 4)
  ihdr[8] = 8   // bit derinliği
  ihdr[9] = 6   // renk tipi: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    parca('IHDR', ihdr),
    parca('IDAT', deflateSync(satirli, { level: 9 })),
    parca('IEND', Buffer.alloc(0))
  ])
}

mkdirSync('public/icons', { recursive: true })
for (const b of [16, 32, 48, 128]) {
  const dosya = `public/icons/icon${b}.png`
  writeFileSync(dosya, png(b))
  console.log(dosya)
}
