// İlan tarihi modele HAM verilmiyor: modelin eğitim verisi geçmişte kaldığı için
// içinde bulunduğumuz yılı "gelecek" sanıp uydurma manipülasyon bayrağı üretiyor.
// Tarihi burada deterministik olarak gün sayısına çeviriyoruz; model yalnız yaşı görüyor.

const AYLAR: Record<string, number> = {
  ocak: 0, şubat: 1, subat: 1, mart: 2, nisan: 3, mayıs: 4, mayis: 4, haziran: 5,
  temmuz: 6, ağustos: 7, agustos: 7, eylül: 8, eylul: 8, ekim: 9, kasım: 10, kasim: 10, aralık: 11, aralik: 11
}

// "01 Ağustos 2026" → Date. Tanınmayan biçimde null.
export function trTarihAyristir(metin: string): Date | null {
  const p = metin.trim().toLocaleLowerCase('tr').match(/^(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})$/)
  if (!p) return null
  const ay = AYLAR[p[2]]
  if (ay === undefined) return null
  const g = parseInt(p[1], 10), y = parseInt(p[3], 10)
  const d = new Date(y, ay, g)
  return d.getFullYear() === y && d.getMonth() === ay && d.getDate() === g ? d : null
}

// Kaç gündür yayında. Gelecek tarih (veri hatası) → 0. Ayrıştırılamazsa null.
export function ilanYasiGun(metin: string | undefined, bugun = new Date()): number | null {
  if (!metin) return null
  const d = trTarihAyristir(metin)
  if (!d) return null
  const gun = Math.floor((bugun.getTime() - d.getTime()) / 86_400_000)
  return gun < 0 ? 0 : gun
}

// Modele gidecek insan-okunur özet.
export function ilanYasiMetni(gun: number | null): string | null {
  if (gun === null) return null
  if (gun <= 1) return 'bugün yayınlandı'
  if (gun < 30) return `${gun} gündür yayında`
  const ay = Math.floor(gun / 30)
  return ay === 1 ? '1 aydır yayında' : `${ay} aydır yayında`
}

// ekAlanlar'dan tarih içeren alanları ayıklar — ham tarih modele gitmemeli.
const TARIH_ANAHTARLARI = ['ilan tarihi', 'tarih']
export function tarihAlanlariniAyikla(ekAlanlar: Record<string, string>): {
  temiz: Record<string, string>; ilanTarihi?: string
} {
  const temiz: Record<string, string> = {}
  let ilanTarihi: string | undefined
  for (const [k, v] of Object.entries(ekAlanlar)) {
    if (TARIH_ANAHTARLARI.includes(k.toLocaleLowerCase('tr').trim())) {
      ilanTarihi ??= v
    } else {
      temiz[k] = v
    }
  }
  return { temiz, ilanTarihi }
}
