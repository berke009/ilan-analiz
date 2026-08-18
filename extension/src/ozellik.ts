export type Ozellik = { vites: 'otomatik' | 'manuel' | null; yakit: 'dizel' | 'benzin' | 'lpg' | 'hibrit' | 'elektrik' | null }

const VITES_ANAHTAR: [string, 'otomatik' | 'manuel'][] = [
  ['otomatik', 'otomatik'], ['dsg', 'otomatik'], ['dct', 'otomatik'], ['tiptronic', 'otomatik'],
  ['edc', 'otomatik'], ['eat', 'otomatik'], ['s-tronic', 'otomatik'], ['steptronic', 'otomatik'],
  ['manuel', 'manuel'], ['düz vites', 'manuel']
]

const YAKIT_ANAHTAR: [string, Ozellik['yakit']][] = [
  ['dizel', 'dizel'], ['tdi', 'dizel'], ['crdi', 'dizel'], ['multijet', 'dizel'], ['bluehdi', 'dizel'],
  ['hdi', 'dizel'], ['cdi', 'dizel'], ['jtd', 'dizel'], ['dci', 'dizel'],
  ['benzin', 'benzin'], ['tsi', 'benzin'], ['tfsi', 'benzin'], ['gdi', 'benzin'], ['vti', 'benzin'], ['mpi', 'benzin'],
  ['lpg', 'lpg'],
  ['hibrit', 'hibrit'], ['hybrid', 'hibrit'],
  ['elektrik', 'elektrik']
]

// Türkçe küçültme 'I'yı 'ı' yapar; "TDI" → "tdı" olur ve 'tdi' anahtarı hiç tutmaz
// (TSI/HDI/CDI/DCI/GDI/VTI/MPI/CRDI/TIPTRONIC aynı tuzağa düşüyordu). Noktalı/noktasız
// İ-ı çiftini önce ASCII 'i'ye indirgeyip sonra küçültüyoruz.
function kucult(s: string): string {
  return s.replace(/İ/g, 'i').replace(/ı/g, 'i').toLowerCase()
}

// Anahtarlar harf sınırıyla aranır: 'eat' (EAT şanzıman) düz indexOf ile
// "Seat", "Leather", "Heated" içinde de eşleşiyor ve aracı otomatik sanıyordu.
// Sınır yalnız HARF dışlar, rakam değil — şanzıman/motor adları rakamla bitişik
// yazılıyor (EAT8, EAT6, 4EAT, 150TDI) ve rakamı da dışlayan bir sınır onları kaçırır.
const sinirli = new Map<string, RegExp>()
function kalip(anahtar: string): RegExp {
  let r = sinirli.get(anahtar)
  if (!r) {
    r = new RegExp(`(?<!\\p{L})${anahtar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!\\p{L})`, 'u')
    sinirli.set(anahtar, r)
  }
  return r
}

function ilkEslesen<T>(metin: string, anahtarlar: [string, T][]): T | null {
  let enErken: { idx: number; deger: T } | null = null
  for (const [anahtar, deger] of anahtarlar) {
    const idx = metin.search(kalip(anahtar))
    if (idx !== -1 && (enErken === null || idx < enErken.idx)) enErken = { idx, deger }
  }
  return enErken?.deger ?? null
}

// Erken eşleşme kazanır — çağıran, güvenilir alanları (ilan.vites/ilan.yakit)
// serbest metinden ÖNCE vermelidir, yoksa başlıktaki reklam metni onları ezer.
export function ozellikCikar(...metinler: (string | null | undefined)[]): Ozellik {
  const metin = kucult(metinler.filter((m): m is string => !!m).join(' '))
  return { vites: ilkEslesen(metin, VITES_ANAHTAR), yakit: ilkEslesen(metin, YAKIT_ANAHTAR) }
}
