// Açıklama metni Gemini'ye — yani yurt dışına — gidiyor. İlan kamuya açık olsa da
// içindeki telefon/e-posta/IBAN/TCKN kişisel veridir; KVKK'da yurt dışı aktarımın
// ekseni tam olarak bu alanlar.
//
// SİLMİYORUZ, MASKELİYORUZ. "[telefon] [telefon] [iban]" satıcı hakkında hiçbir şey
// söylemez ama YAPIYI korur: "Kimden: Sahibinden" yazıp açıklamaya üç numara ve IBAN
// bırakmış ilan, gizli galeri sinyalidir ve analiz rubriğinde "açıklama tutarlılığı"
// kalemi bunu kullanıyor. Düz silme o sinyali de yok ederdi.
//
// SIRA: maske, ilan metni sağlayıcıya GÖNDERİLMEDEN hemen önce uygulanır (sw.ts).
// Sonra uygulamak hiçbir işe yaramazdı — ham telefon çoktan üçüncü tarafa gitmiş
// olurdu. Analiz kullanıcının tarayıcısında üretildiği için saklanan tek türev,
// kendi cihazındaki 24 saatlik sonuç önbelleği.

export const PII_YER = {
  tel: '[telefon]', eposta: '[e-posta]', plaka: '[plaka]', tckn: '[tckn]', iban: '[iban]'
} as const

// TR + 24 hane, 4'erli boşluklu yazım dahil. Yanlış pozitif yok: araç ilanında
// "TR" ardından 24 hane gelen başka bir veri türü yok ("TR plakalı" 24 hane değil).
const IBAN = /\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/gi

// Boşluklu "info @ galeri.com" kaçırma yazımı da yakalanır. '@' araç verisinde geçmiyor.
// Kapsam dışı: "@instagram_kullanici" — alan adı olmadığı için eşleşmez, bilinçli
// (işletme hesabı adı kişisel veri ekseninde farklı bir tartışma).
const EPOSTA = /[A-Za-z0-9._%+-]+\s?@\s?[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

// TCKN: 11 hane. Ayıraçlı sayı ("1.550.000") BİTİŞİK 11 hane üretmediği için
// fiyat/km buraya hiç girmez. Girse bile doğrulama basamakları eliyor: rastgele
// 11 hanenin ~%1'i geçerli. Bu yüzden checksum ZORUNLU — o olmadan ilan numarası
// gibi uzun kimlikler yanlışlıkla maskelenirdi.
const TCKN = /(?<!\d)\d{11}(?!\d)/g

function tcknMu(d: string): boolean {
  if (!/^[1-9]\d{10}$/.test(d)) return false // TCKN 0 ile başlamaz (0'lı 11 hane = telefon)
  const h = [...d].map(Number) as number[]
  const tek = h[0]! + h[2]! + h[4]! + h[6]! + h[8]!
  const cift = h[1]! + h[3]! + h[5]! + h[7]!
  if (((tek * 7 - cift) % 10 + 10) % 10 !== h[9]) return false // JS'te negatif % negatif döner
  return (tek + cift + h[9]!) % 10 === h[10]
}

// Plaka: il kodu 01-81 + harf + rakam. Asıl yanlış pozitif kalkanı KOMBİNASYON kuralı:
// resmî biçimler 1 harf+4, 2 harf+3/4, 3 harf+2 rakam. Bu kural olmadan
// "205 55 R16" → "55 R16" ve "1.6 16V 110" → "16V 110" maskelenirdi (ikisi de
// geçersiz kombinasyon olduğu için elenir).
// 3 harf+3 rakam resmî DEĞİL ama sahada böyle yazılıyor; kabul ediyoruz, bedeli
// "34 GLA 250" gibi rozet dizilerini yakalama riski — kara liste onu kapatıyor.
// BÜYÜK HARF ŞART (regex'te 'i' bayrağı YOK). Asıl yanlış pozitif sınıfı kara listeyle
// kapanmıyordu: "<sayı> <türkçe kelime> <sayı>" kalıbının tamamı geçerli kombinasyona
// düşüyor — "36 ay 1500 TL", "24 ay 2026 garantili", "50 bin 500". Kara liste bunları
// tek tek kovalamak zorunda kalır ve sonsuza kadar sızdırır. Plaka Türkçe metinde
// neredeyse her zaman BÜYÜK yazılır, cümle içi kelimeler küçük — ayrım bedava ve genel.
// Bedeli: "34 abc 123" küçük yazımı kaçar. Maske tek savunma değil, bu takas doğru.
const PLAKA = /(?<!\w)(0[1-9]|[1-7]\d|8[01])\s?([A-Z]{1,3})\s?(\d{2,4})(?!\w)/g
const GECERLI_KOMBO: Record<number, number[]> = { 1: [4], 2: [3, 4], 3: [2, 3] }
// Geçerli kombinasyona DENK DÜŞEN motor/donanım rozetleri ve BÜYÜK yazılan birimler.
// 'V' kritik: "1.6 16V 1598 cc" → 16 + V + 1598 = geçerli kombo, motor hacmi siliniyordu.
// 'AY' kritik: "Taksitle 18 AY 2000 TL" büyük yazıldığında harf kuralına takılmıyor.
const ROZET = new Set(['TDI', 'TSI', 'CDI', 'HDI', 'DCI', 'GTI', 'GTD', 'MPI', 'GDI', 'ABS', 'ESP',
  'EDC', 'DSG', 'DCT', 'CVT', 'AMG', 'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'CLA', 'CLS', 'SLK', 'RS',
  'LED', 'HP', 'BG', 'PS', 'KW', 'CC', 'KM', 'TL', 'MT', 'AT', 'CM', 'MM', 'KG', 'VW', 'SUV',
  'V', 'AY', 'YIL', 'ADET', 'GB', 'INC', 'NM', 'HZ', 'W'])

// Telefon: TEK regex yerine "aday koşuyu bul + parça pencerelerini TAM doğrula".
// Ayıraçları (boşluk/nokta/tire/parantez) regex içinde serbest bırakan tek-regex
// yaklaşımı "50.000 90.000" gibi bitişik sayı dizilerinden 10 hane KIRPIP telefon
// sanıyor. Burada hane sayısı TAM eşleşmek zorunda, o yüzden o sınıf hata kalmıyor.
// Üst sınır cömert: iki numara tek koşuya düşebiliyor ("0532 ... - 0555 ...", 31 karakter)
// ve koşu kırpılırsa ikincisi eksik hane sayısıyla doğrulamayı geçemez, yani KAÇARDI.
const TEL_KOSU = /(?<![\d\p{L}])\(?\+?\d[\d\s.\-()]{7,60}\d(?![\d\p{L}])/gu
// Türkçe binlik ayıracı: 150.000 / 1.500.000. Pencerede böyle bir parça varsa o
// pencere sayı dizisidir, telefon değil — "2015 150.000" 10 hanedir ve telefon sanılırdı.
const BINLIK = /^\d{1,3}(?:\.\d{3})+$/

// Koşunun tamamı tek numara olmayabilir: "0532 ... - 0555 ..." iki numaradır ve
// tire ayıraç sınıfında olduğu için tek koşu gelir. Boşlukla ayrılmış parçalar
// üzerinde EN UZUN geçerli pencereyi arıyoruz; pencere geçerli değilse hiçbir şey
// maskelenmez (kırpma yok — yanlış pozitif kalkanı bu).
function telefonMaskele(kosu: string): string {
  const p = kosu.split(/(\s+)/) // çift index: parça, tek index: boşluk
  const cikti: string[] = []
  let i = 0
  while (i < p.length) {
    if (i % 2 === 1 || !/\d/.test(p[i]!) || BINLIK.test(p[i]!)) { cikti.push(p[i]!); i++; continue }
    let son = -1
    for (let j = p.length - 1 - ((p.length - 1) % 2); j >= i; j -= 2) {
      const pencere = p.slice(i, j + 1)
      if (!/\d/.test(p[j]!) || pencere.some(t => BINLIK.test(t))) continue
      if (telefonMu(pencere.join('').replace(/\D/g, ''))) { son = j; break }
    }
    if (son === -1) { cikti.push(p[i]!); i++; continue }
    cikti.push(PII_YER.tel)
    i = son + 1
  }
  return cikti.join('')
}

function telefonMu(h: string): boolean {
  const g = h.replace(/^(?:0090|90)/, '')
  // Cepte 0/+90 önekini şart koşmuyoruz ("532 123 45 67" yaygın).
  // Alan koduyla (sabit hat / 0'lı yazım) 0 ÖNEKİ ŞART: 0'sız "2015150000" gibi
  // yıl+km birleşmeleri aksi hâlde telefon olurdu.
  return /^5\d{9}$/.test(g) || /^0[2-5]\d{9}$/.test(g)
}

// Maskelemeyi atlatmak için harfle yazım ("sıfır beş üç iki ..."). Listede YALNIZ
// birim rakamlar var; "bir milyon dört yüz elli bin" gibi yazıyla fiyat, araya giren
// yüz/bin/milyon yüzünden 7'lik diziyi hiç kuramaz.
// \b KULLANILAMAZ: JS'te ASCII tabanlı, 'ü' kelime karakteri sayılmıyor ve "üç"
// hiç eşleşmiyordu. Sınırı \p{L} ile kuruyoruz.
const RAKAM_SOZ = 'sıfır|sifir|bir|iki|üç|uc|dört|dort|beş|bes|altı|alti|yedi|sekiz|dokuz'
const TEL_YAZI = new RegExp(`(?:(?<!\\p{L})(?:${RAKAM_SOZ})(?!\\p{L})[\\s.,\\-]*){7,}`, 'giu')

export function maskeleMetin(s: string): string {
  return s
    .replace(IBAN, PII_YER.iban)
    .replace(EPOSTA, PII_YER.eposta)
    .replace(TCKN, m => (tcknMu(m) ? PII_YER.tckn : m))
    .replace(PLAKA, (m, _il, harf: string, rakam: string) =>
      GECERLI_KOMBO[harf.length]?.includes(rakam.length) && !ROZET.has(harf.toUpperCase())
        ? PII_YER.plaka : m)
    .replace(TEL_KOSU, telefonMaskele)
    .replace(TEL_YAZI, PII_YER.tel + ' ')
}

// Modele giden serbest metin taşıyan TÜM alanlar. ekAlanlar dahil: içeriği DOM'daki
// etiket listesinden geliyor, yani sınırsız — güvenilir sayılamaz.
export function maskeleIlan<T extends {
  baslik: string; aciklamaText: string | null; ekAlanlar: Record<string, string>
}>(ilan: T): T {
  ilan.baslik = maskeleMetin(ilan.baslik)
  if (ilan.aciklamaText) ilan.aciklamaText = maskeleMetin(ilan.aciklamaText)
  for (const [k, v] of Object.entries(ilan.ekAlanlar)) ilan.ekAlanlar[k] = maskeleMetin(v)
  return ilan
}
