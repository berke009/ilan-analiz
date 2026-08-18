import { describe, it, expect } from 'vitest'

// Bu davranışların hepsi CANLIDA ÖLÇÜLEREK kazanıldı: LLM'in ürettiği JSON üç ayrı
// şekilde bozuluyordu ve üçü de logda görünmüyordu. Kod shared/analiz.ts'e taşındığı
// için testleri de buraya taşındı — backend küçültülürken sessizce kaybolmasınlar.
describe('hız limiti tespiti', () => {
  it('429 ve rate limit varyantlarını yakalar', async () => {
    const { hizLimitiMi } = await import('../src/analiz')
    expect(hizLimitiMi(new Error('openai-uyumlu HTTP 429: {...}'))).toBe(true)
    expect(hizLimitiMi(new Error('RESOURCE_EXHAUSTED'))).toBe(true)
    expect(hizLimitiMi(new Error('rate limit exceeded'))).toBe(true)
    expect(hizLimitiMi(new Error('HTTP 500'))).toBe(false)
    expect(hizLimitiMi(new Error('JSON bulunamadı'))).toBe(false)
  })
})

describe('kredi tükenmesi hız limitinden ayrılır', () => {
  it('Google\'ın "prepayment credits are depleted" 429\'u kredi hatasıdır', async () => {
    const { krediHatasiMi, hizLimitiMi } = await import('../src/analiz')
    const e = new Error('openai-uyumlu HTTP 429: {"error":{"code":429,"message":"Your prepayment credits are depleted.","status":"RESOURCE_EXHAUSTED"}}')
    expect(krediHatasiMi(e)).toBe(true)
    // Beklemek bunu düzeltmez; hız limiti sayıp retry etmek boşuna gecikme
    expect(hizLimitiMi(e)).toBe(false)
  })
  it('gerçek hız limiti hâlâ hız limiti sayılır', async () => {
    const { krediHatasiMi, hizLimitiMi } = await import('../src/analiz')
    const e = new Error('openai-uyumlu HTTP 429: rate limit exceeded, retry in 20s')
    expect(krediHatasiMi(e)).toBe(false)
    expect(hizLimitiMi(e)).toBe(true)
  })
  it("'credit balance' içeren hata da kredi hatasıdır", async () => {
    const { krediHatasiMi } = await import('../src/analiz')
    expect(krediHatasiMi(new Error('insufficient credit balance'))).toBe(true)
  })
})

// Canlıda ölçüldü: model geçerli GÖRÜNEN JSON üretiyor ama ayrıştırılamıyordu.
// Sebep logda görünmüyordu çünkü log boşlukları sıkıştırıyor.
describe('LLM bozuk JSON onarımı', () => {
  it('string içindeki gerçek satır sonu onarılır', async () => {
    const { extractJson } = await import('../src/analiz')
    expect(extractJson('{"skor":5.4,"ozet":"birinci satır\nikinci satır"}'))
      .toEqual({ skor: 5.4, ozet: 'birinci satır\nikinci satır' })
  })
  it('tab ve satır başı da onarılır', async () => {
    const { extractJson } = await import('../src/analiz')
    expect((extractJson('{"a":"x\ty\r\nz"}') as any).a).toBe('x\ty\r\nz')
  })
  it('sondaki virgül onarılır', async () => {
    const { extractJson } = await import('../src/analiz')
    expect(extractJson('{"a":1,"b":[1,2,],}')).toEqual({ a: 1, b: [1, 2] })
  })
  it('```json bloğu içinde bozuk JSON da onarılır', async () => {
    const { extractJson } = await import('../src/analiz')
    expect(extractJson('```json\n{"a":"iki\nsatır"}\n```')).toEqual({ a: 'iki\nsatır' })
  })
  it('GEÇERLİ JSON değiştirilmeden döner — onarım ona hiç dokunmaz', async () => {
    const { extractJson } = await import('../src/analiz')
    const kaynak = { skor: 7.4, ozet: 'ters bölü \\ ve tırnak " içerir', dizi: [1, 2, 3] }
    expect(extractJson(JSON.stringify(kaynak))).toEqual(kaynak)
  })
  it('ayrıştırılamayan metin: hata tek satır, kırılma noktası ve örnek içerir', async () => {
    const { extractJson } = await import('../src/analiz')
    let mesaj = ''
    try { extractJson('sadece\ndüz metin') } catch (e: any) { mesaj = e.message }
    expect(mesaj).toContain('JSON bulunamadı')
    expect(mesaj).toContain('16 karakter')
    expect(mesaj).toMatch(/\[.*Unexpected token.*\]/)   // kırılma noktası korunuyor
    expect(mesaj).not.toContain('\n')                    // tek satır — log bölünmesin
  })
})

// Doğrulama turunda yakalandı: onarımın sondaki-virgül regex'i metnin TAMAMINA
// uygulanıyordu ve kullanıcıya gösterilen özetten virgülü sessizce siliyordu.
describe('onarım string içeriğini BOZMAZ', () => {
  it('özet içindeki ", }" olduğu gibi kalır', async () => {
    const { extractJson } = await import('../src/analiz')
    // ham \n onarımı tetikler; virgül korunmalı
    const d = extractJson('{"ozet":"fiyat, } beklenenin ustunde\nikinci satir"}') as any
    expect(d.ozet).toBe('fiyat, } beklenenin ustunde\nikinci satir')
  })
  it('özet içindeki ", ]" de korunur', async () => {
    const { extractJson } = await import('../src/analiz')
    expect((extractJson('{"a":"x, ] y\nz"}') as any).a).toBe('x, ] y\nz')
  })
  it('gerçek sondaki virgül hâlâ temizleniyor', async () => {
    const { extractJson } = await import('../src/analiz')
    expect(extractJson('{"a":1,"b":[1,2,],}')).toEqual({ a: 1, b: [1, 2] })
  })
  it('Türkçe noktalama ve parantez bozulmuyor', async () => {
    const { extractJson } = await import('../src/analiz')
    const metin = 'Medyanın %29 altında (piyasa, ) üstünde; km\'si yüksek.'
    expect((extractJson(JSON.stringify({ ozet: metin })) as any).ozet).toBe(metin)
  })
  it('eksik virgüllü eski "kırık" örnek artık ONARILIYOR (davranış bilinçli değişti)', async () => {
    const { extractJson } = await import('../src/analiz')
    expect(extractJson('{"a":1 "b":2}')).toEqual({ a: 1, b: 2 })
  })
  it('onarılamayan metinde hata mesajı kırılma noktasını taşır', async () => {
    const { extractJson } = await import('../src/analiz')
    expect(() => extractJson('{"a": çıplak}')).toThrow(/JSON bulunamadı.*\[.*Unexpected|JSON bulunamadı.*\[.*token/)
  })
})

// Canlıda ölçüldü: response_format Gemini uyumluluk katmanında ZORLANMIYOR —
// 200 dönüp bozuk JSON gelebiliyor (6'da 1). En sık bozulma: eksik virgül.
describe('eksik virgül onarımı (ayrıştırıcı konumuyla)', () => {
  it('dizi elemanları arasındaki eksik virgül onarılır — canlı hatanın birebir kalıbı', async () => {
    const { extractJson } = await import('../src/analiz')
    const d = extractJson('{\n "skor": 6.8,\n "chipler": [\n  "Dizel"\n  "Otomatik",\n  "2017 Model"\n ]\n}') as any
    expect(d.chipler).toEqual(['Dizel', 'Otomatik', '2017 Model'])
  })
  it('nesne alanları arasındaki eksik virgül de onarılır', async () => {
    const { extractJson } = await import('../src/analiz')
    expect(extractJson('{"a":1\n"b":2}')).toEqual({ a: 1, b: 2 })
  })
  it('birden çok eksik virgül tek geçişte düzelir', async () => {
    const { extractJson } = await import('../src/analiz')
    const d = extractJson('{"x":["a"\n"b"\n"c"]\n"y":["d"\n"e"]}') as any
    expect(d).toEqual({ x: ['a', 'b', 'c'], y: ['d', 'e'] })
  })
  it('eksik virgül + string içinde ham satır sonu BİRLİKTE onarılır', async () => {
    const { extractJson } = await import('../src/analiz')
    const d = extractJson('{"ozet":"iki\nsatır"\n"skor":7}') as any
    expect(d).toEqual({ ozet: 'iki\nsatır', skor: 7 })
  })
  it('virgülle alakasız bozukluk hâlâ hata verir — onarım her şeyi yutmaz', async () => {
    const { extractJson } = await import('../src/analiz')
    expect(() => extractJson('{"a": çıplak_kelime}')).toThrow(/JSON bulunamadı/)
  })
  it('geçerli JSON değişmeden döner', async () => {
    const { extractJson } = await import('../src/analiz')
    const kaynak = { chipler: ['a, b', 'c'], ozet: 'virgül, içeren "metin"' }
    expect(extractJson(JSON.stringify(kaynak))).toEqual(kaynak)
  })
})

// Üçüncü canlı bozulma: dizi ']' yerine '}' ile kapanıyor. jsonrepair kütüphanesi bu
// kalıbı anlamı bozarak "onardığı" için elendi; yığın tabanlı düzeltici deterministik.
describe('yanlış parantez onarımı', () => {
  it('canlı pencerenin birebir kalıbı: dizi } ile kapanmış', async () => {
    const { extractJson } = await import('../src/analiz')
    const d = extractJson('{\n "bayraklar": [\n  {"tip":"sari","metin":"r."}\n },\n "avantajlar": ["a"]\n}') as any
    expect(d.bayraklar).toEqual([{ tip: 'sari', metin: 'r.' }])
    expect(d.avantajlar).toEqual(['a'])
  })
  it('nesne ] ile kapanmışsa da düzelir', async () => {
    const { extractJson } = await import('../src/analiz')
    expect(extractJson('{"a": {"b": 1], "c": 2}')).toEqual({ a: { b: 1 }, c: 2 })
  })
  it('kapanış hiç yoksa tamamlanır', async () => {
    const { extractJson } = await import('../src/analiz')
    expect(extractJson('{"a": [1, 2')).toEqual({ a: [1, 2] })
  })
  it('string İÇİNDEKİ parantezlere dokunulmaz', async () => {
    const { extractJson } = await import('../src/analiz')
    const kaynak = { ozet: 'fiyat [medyan] üstünde } ve { altında' }
    expect(extractJson(JSON.stringify(kaynak))).toEqual(kaynak)
  })
  it('üç bozulma BİRLİKTE: ham satır sonu + eksik virgül + yanlış parantez', async () => {
    const { extractJson } = await import('../src/analiz')
    const d = extractJson('{\n "x": ["a"\n "b"}\n "y": "iki\nsatır"\n}') as any
    expect(d).toEqual({ x: ['a', 'b'], y: 'iki\nsatır' })
  })
})
