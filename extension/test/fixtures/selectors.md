# Sahibinden Selector Notları

> ⚠️ Bu fixture'lar Cloudflare bot koruması nedeniyle canlı sayfadan **çekilemedi**; gerçek sahibinden markup yapısına sadık şekilde **elle kuruldu** (Task 2, kullanıcı onayıyla). Aşağıdaki seçiciler hem fixture'larda hem parser kodunda kullanılıyor. **Seçiciler canlı sayfa yapısına karşı doğrulandı** — parser alan-bağımsız null stratejisiyle yazıldığı için seçici uyuşmazlığı çökme değil eksik-veri olarak görünür.

## Detay sayfası (`detay-*.html`)

| Amaç | Seçici | Not |
|---|---|---|
| Detay konteyneri (mod tespiti) | `#classifiedDetail` | Varsa detay modu |
| Başlık | `.classifiedDetailTitle h1` | |
| Fiyat | `.classifiedInfo h3` | "875.000 TL" biçimi |
| İl / İlçe | `.classifiedInfo h2 a` | [0]=il, [1]=ilçe |
| Özellik listesi | `ul.classifiedInfoList li` | her li: `<strong>Etiket:</strong><span>Değer</span>` |
| Açıklama | `#classifiedDescription` | |
| Breadcrumb | `.bc-item > a` | Kap: `.search-result-bc > ul > li.bc-item`. [0]=Vasıta, [1]=kategori, son = en derin model/donanım yolu, sondan bir önceki = yedek yol. **`> a` şart**: her `li.bc-item` içinde bir de `.bc-tooltip` var (kardeş modellerin açılır listesi, onlarca link). |
| İlan No | `ul.classifiedInfoList` içinde "İlan No" li'si | URL regex `-(\d+)` önceliklidir |

Etiket→alan eşlemesi (Türkçe): Marka, Seri, Model, Yıl, KM, Yakıt Tipi→yakit, Vites, Ağır Hasar Kayıtlı, Kimden. Eşleşmeyenler (Motor Gücü, Çekiş, Kasa Tipi, Renk, Garanti, Takas, Araç Durumu…) → `ekAlanlar`.

## Liste sayfası — üç görünüm

sahibinden aramayı **üç ayrı düzende** sunar ve `viewType` sorgu parametresiyle geçiş yapılır.
Aşağıdaki tablo **canlı sayfada doğrulandı** (fixture'lar da o yapıya göre yenilendi).

| | Klasik (`viewType` yok / bilinmeyen değer) | `viewType=List` | `viewType=Gallery` |
|---|---|---|---|
| Kap | `#searchResultsTable tr[data-id]` | `#searchResultsTable tr[data-id]` | `td.searchResultsGalleryItem[data-id]` — `#searchResultsTable` **hiç yok** |
| Marka/Seri/Model | `.searchResultsTagAttributeValue` [0][1][2] | **yok** | **yok** |
| Yıl / KM | `.searchResultsAttributeValue` [0][1] | **yok** | `.searchResultsGallerySubContent > div`, `Yıl:` / `KM:` etiketiyle |
| Başlık + URL | `a.classifiedTitle` | `a.classifiedTitle` | `a.classifiedTitle` (class'ta boşluk var: `" classifiedTitle "`) |
| Fiyat | `.searchResultsPriceValue` | `.searchResultsPriceValue` | `.searchResultsPriceValue` |
| İl | `.searchResultsLocationValue` ilk satır | aynı | `İl / İlçe:` etiketi, `/`'ten önceki kısım |
| Küçük resim (rozet yeri) | ilk `td` = `.searchResultsLargeThumbnail` | aynı | satırın **kendisi** `<td>`; içteki `.searchResultsLargeThumbnail` |

Sonuçlar:
- **Mod tespiti** `SATIR_SECICI` ile yapılır (üç görünümü de kapsar) — `#searchResultsTable`'a bağlanmak galeri görünümünde eklentiyi tamamen sessiz bırakıyordu.
- Galeri kartının **içinde bir de `<tr data-id>` var**; parser `data-id`'ye göre tekilleştirir.
- `viewType=List` satırlarında yıl/km yok → skor yalnız başlık+fiyattan çıkar. Bu satırlar yerel depoda ayrı anahtara yazılır ki zengin skoru ezmesin.

## Kategori kapsamı
Detay: otomobil, arazi/SUV/pickup, motosiklet, minivan/panelvan, ticari — hepsi aynı `ul.classifiedInfoList` yapısını kullanır (kategoriye özgü alanlar `ekAlanlar`'a düşer). Tek generic parser yeterli.

## Breadcrumb

Eski `.classifiedBreadCrumb a` seçicisi **canlı sayfada 0 eleman** eşliyordu; `modelAramaPath`
her ilanda null kalıyordu; karşılaştırma o yola göre anahtarlandığı için hiç eşleşme bulunamıyordu. Sonuç:
fiyat istatistiği, pazarlık bandı, karşılaştırma listesi ve alternatifler **hiçbir ilanda**
görünmüyordu. Gerçek yapı:

```
<div class="search-result-bc"><ul>
  <li class="bc-item"><a href="/kategori/vasita">Vasıta</a><i class="bc-arrow"></i>
    <div class="bc-tooltip"><a …>…</a>…</div></li>
  … <li class="bc-item"><a href="/mercedes-benz-c-serisi-c-200-amg">AMG</a>…</li>
</ul></div>
```

En derin kırıntı **donanım** seviyesinde olabiliyor. Ölçülen örnek:
`/ornek-marka-model` → N ilan (eşleşen M),
bir üstü `/ornek-marka-model` → N ilan (eşleşen M). Bu yüzden
`ustAramaPath` taşınıyor ve örneklem 5'in altındaysa oraya düşülüyor.
