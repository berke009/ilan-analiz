# Katkı

En değerli katkı **yeni site adaptörü**. Mimari bunun için kuruldu: siteye özel kod
yaklaşık 130 satır, geri kalan her şey (panel, skorlama, karşılaştırma, analiz) siteden
bağımsız çalışıyor.

## Önce: değişmez kural

**Uzantı hiçbir koşulda kendiliğinden sayfa istemez.** Adaptörünüz yalnız kullanıcının o
an açtığı belgeyi (`Document`) okur. `fetch`, `XMLHttpRequest`, arka plan çekimi, crawler
ya da zamanlanmış görev eklemeyin.

Bu kural teste bağlı: `extension/test/similar.test.ts` içindeki "ağ erişimi yok" bloğu
karşılaştırma yolunda bir ağ çağrısı belirirse patlar. Bu testi devre dışı bırakan PR
kabul edilmez.

Aynı şey fixture'lar için de geçerli: sayfa **yapısını** göstermek serbest, sayfa
**içeriğini** depoya taşımak değil.

## İkinci değişmez: sunucu analiz akışına girmez

Sunucumuz model çağırmaz, API anahtarı görmez ve ilan içeriği almaz. İsteğe bağlı
[paylaşılan önbellek](docs/paylasilan-onbellek.md) bunu değiştirmiyor: vekil değil, yan
yol — önbellekte kayıt yoksa istek yine doğrudan kullanıcının kendi anahtarıyla Google'a
gider. Sunucuyu araya sokan bir PR kabul edilmez.

O katmana dokunuyorsanız iki kuralı bozmayın:

- **Sayı paylaşılmaz.** Fiyat istatistiği, km durumu ve pazarlık hedefi okuyanın kendi
  cihazında hesaplanır. `paylasimaHazirla` alanları tek tek sayıyor; yayma (spread)
  kullanmak, şemaya sonradan eklenen bir alanın habersizce paylaşıma sızması demek.
- **Varsayılan kapalı.** `PAYLASIM_ACIK` verilmeden sunucuda uçlar kurulmaz,
  `PAYLASIM_KOK` verilmeden uzantıda özellik hiç bulunmaz. Bu üç testle bağlı:
  `backend/test/onbellek.test.ts` → "paylaşım kapalıyken sunucu bugünküyle aynı",
  `extension/test/paylasim.test.ts` → "üç katmanlı kapalılık",
  `extension/test/sw.test.ts` → "KAPALIYKEN sunucumuza hiç istek gitmez".
  Adres verilerek derlenen pakette kurulum ekranındaki onay kutusu önceden işaretli
  gelir; bu bir istisna değil, o üç katmanın en üstündeki kullanıcı tercihi. Kutuyu
  kaldırmak da tarayıcının izin penceresinde hayır demek de tek başına yeterli.

## Yeni site adaptörü

`extension/src/siteler/arabam.ts` örnek alınacak dosya. (`sahibinden.ts`'e bakmayın —
o, projenin ilk hâlinden kalan `parseDetail.ts` / `parseList.ts` dosyalarına delege eden
ince bir sarmalayıcı, temsili değil.)

### 1. Kayda ekleyin

`extension/src/siteler/kayit.json`:

```json
{ "ad": "ornek", "kok": "https://www.ornek.com", "eslesenler": ["https://www.ornek.com/*"] }
```

Manifest bu dosyadan **üretiliyor** — `content_scripts` ve `host_permissions` elle
güncellenmez.

### 2. Adaptörü yazın

`extension/src/siteler/ornek.ts`, `SiteAdaptoru` arayüzünü uygular:

```ts
export const ornek: SiteAdaptoru = {
  ad, kok, satirSecici,
  sayfaTipi(doc)            // 'detay' | 'liste' | null
  detayOku(doc, url)        // ListingDetail | null
  listeSatirlari(doc)       // ListRow[]
}
```

Sonra `extension/src/siteler/index.ts` içindeki `ADAPTORLER` dizisine ekleyin.

Evet, iki yer: `kayit.json` manifesti üretir, `ADAPTORLER` çalışma zamanında kimin
okuyacağını söyler. Bu ikisinin ayrışması **sessiz** bir hatadır — kayıtta olup adaptörü
olmayan site için kullanıcıdan izin istenir ama hiçbir şey çalışmaz. Bu yüzden
`extension/test/kayit.test.ts` ikisini karşılaştırır ve biri eksikse patlar; unutursanız
test söyler.

### 3. Fixture çıkarın

Bir detay ve bir liste sayfasının HTML'ini `extension/test/fixtures/` altına koyun.
Sadeleştirin: script, style, SVG ve görselleri atın, birkaç satır bırakın.

**İlan numaralarını, ilan başlıklarını, URL parçalarını ve satıcının yazdığı serbest
metinleri sentetikle değiştirin.** Konum bilgisini il düzeyinde bırakın, mahalleye
inmeyin. Yıl, kilometre ve fiyat gibi sayısal değerler kalabilir. Fixture, sitenin DOM
yapısını göstermek içindir; içeriğini yayınlamak için değil.

### 4. Test yazın

`extension/test/ornek.test.ts` — `arabam.test.ts` iyi bir örnek. En az şunları doğrulayın:

- Sayfa tespiti: detay, liste ve alakasız sayfa
- Detay: marka, seri, model, yıl, km, fiyat, yakıt, vites, arama yolları
- Liste: satır sayısı, ilan numaraları, fiyat, **yıl ve km'nin birbirine karışmaması**
- Eşleşmeyen etiketlerin `ekAlanlar`'a düşmesi

Tek dosya çalıştırmak için:

```bash
pnpm --filter extension test test/ornek.test.ts
```

## Ayrıştırıcı yazarken

Bu proje bu hataları zaten yaptı; tekrarlamayın:

**Konuma değil şekle/etikete güvenin.** Sütun sırası görünüme göre değişiyor. Alanları
etiket metninden (`Kilometre`, `Vites Tipi`) veya biçimden (yıl 4 hanelidir) okuyun.
`etiketAlani()` yardımcısı Türkçe etiket varyantlarını zaten karşılıyor
(`extension/src/parseCommon.ts`).

**Gizli metne dikkat.** Bazı siteler yardımcı metinleri `display:none` ile saklıyor ve
`textContent` onları da veriyor. arabam'da "İlan No" alanı "Kopyalandı 90000013"
çıkıyordu; `arabam.ts` içindeki `gorunurMetin()` bunun için var.

**Bilinmeyeni uydurmayın.** Sitede karşılığı olmayan bir alanı doldurmayın; `null`
bırakın. Örnek: arabam'da ikili "ağır hasar" alanı yok, onun yerine tramer tutarı var —
`agirHasarKayitli` null kalıyor, tutar `ekAlanlar`'a yazılıyor. Yanlış bir "hasarsız"
rozeti, hiç rozet olmamasından kötüdür.

**Marka/model eşleşmesi kırılgandır.** Karşılaştırma satırları arama yoluna göre
anahtarlanıyor; böylece "hepsi aynı model aramasından geldi" değişmezi korunuyor. Bu
değişmezi bozmayın — `eslesenSatirlar` marka/model bakmaz, yalnız yıl ve vites/yakıt
bakar.

## Çalıştırma

```bash
pnpm install
pnpm -r test
pnpm -r exec tsc --noEmit
```

Değişikliğinizi tarayıcıda denemek için:

```bash
pnpm --filter extension build     # extension/dist
```

## PR'da beklenenler

- Testler geçiyor, tip denetimi temiz
- Yeni davranış testle sabitlenmiş
- Ağ isteği eklenmemiş
- Fixture'lar sentetik içerikli

Türkçe ya da İngilizce, ikisi de olur.
