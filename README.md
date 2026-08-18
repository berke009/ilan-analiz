# İlan Analiz

İkinci el araç ilanlarını "satın almaya değer mi" açısından değerlendiren bir tarayıcı
uzantısı. Bir ilan sayfası açtığınızda kilometreyi yaşına göre yorumlar, fiyatı benzer
ilanların medyanıyla karşılaştırır, gerçekçi bir pazarlık hedefi hesaplar ve ilanı alıcı
gözünden özetler.

**Ücretsiz, üyeliksiz, hesapsız.** Analiz sizin tarayıcınızda, sizin kendi yapay zekâ
API anahtarınızla üretilir.

---

## Veri nereye gidiyor

Tek cümlelik hâli: **ilan metni yalnız sizin anahtarınızla Google'a gider, bize hiçbir
şey gelmez.** Ayrıntısı:

| Veri | Nereye | Not |
|---|---|---|
| İlan metni (maskelenmiş) | Google Gemini API | Doğrudan tarayıcınızdan, sizin anahtarınızla. Aktarım sizinle Google arasında; biz aracı değiliz |
| API anahtarınız | Yalnız tarayıcınızın uzantı deposu | Google'a giden istekte kullanılır; bize gönderilmez, içerik script'ine geçmez |
| Açtığınız liste sayfalarının satırları | Yalnız tarayıcınız, 24 saat | Fiyat karşılaştırması için. Yalnız sizin gördüğünüz sayfalardan |
| Ürettiğiniz analizler | Yalnız tarayıcınız, 24 saat | Aynı ilanı tekrar açınca size ücret çıkmasın diye |
| Kullanım istatistiği, çerez, hesap | **Yok** | Toplanmıyor |

Google'a gitmeden önce metindeki telefon, e-posta, IBAN, T.C. kimlik numarası ve plaka
maskelenir (`shared/src/pii.ts`). Bu, ilanı yazan kişinin verisini korumak içindir.

**Bu depoda bir `backend/` klasörü var** — dürüst olmak gerekirse tam olarak "sunucusuz"
değiliz. O sunucunun tek işi statik bir gizlilik politikası sayfası sunmak (mağaza
listelemesi için zorunlu). Analiz akışında yer almaz, veri almaz, veri saklamaz;
uzantı ona hiç istek atmaz. 130 satır, tamamı burada.

## Kırmızı çizgi: kendiliğinden istek yok

**Uzantı hiçbir koşulda kendiliğinden sayfa istemez.** Ne crawler, ne örümcek, ne
zamanlanmış görev, ne arka planda sayfa çekimi. Yalnızca kullanıcının kendi açtığı
sekmedeki DOM okunur.

Fiyat karşılaştırması da buna uyar: kullanıcı bir arama sonucu sayfası açtığında oradaki
satırlar tarayıcısında 24 saat saklanır, detay sayfasında o veriden yararlanılır. Ek istek
yapılmaz. Karşılaştırma için yeterli örnek (5) birikmemişse fiyat konumu **hiç
gösterilmez** — uydurma istatistik üretilmez.

Bu kural teste bağlı, yorumla değil: `extension/test/similar.test.ts` içindeki
"ağ erişimi yok" bloğu, karşılaştırma yoluna bir `fetch` girerse patlar.

## Anahtarınız neden güvende

BYOK bir uzantıya kendi API anahtarınızı vermek haklı olarak tedirgin edicidir. Kodu
okumadan da doğrulayabileceğiniz şeyler:

- Anahtar **yalnız service worker'da** okunur; ilan sayfasına enjekte edilen içerik
  script'ine hiç geçmez. Sayfadaki üçüncü taraf bir kod ele geçse bile anahtara ulaşamaz.
- Anahtarla yapılan tek istek Google'ın API'sine gider. Uzantının manifest'indeki
  `host_permissions` listesi bunu sınırlar — listede ne varsa uzantı ancak oraya çıkabilir.
- Uzantıyı derlemek gizli bir değer istemez. Mağazadaki paketle bu depodan derlediğiniz
  paketi karşılaştırabilirsiniz.
- Anahtarı uzantı penceresinden silebilir, Google AI Studio'dan iptal edebilirsiniz.

Maliyet tarafı: bir analiz yaklaşık **1.200 girdi + 500 çıktı token** harcar. Google'ın
ücretsiz katmanının o anki limitleri için kendi
[fiyatlandırma sayfalarına](https://ai.google.dev/pricing) bakın — kotayı ve ücreti
belirleyen taraf Google, biz değiliz.

## Kurulum

### Anahtar nasıl alınır

1. [Google AI Studio](https://aistudio.google.com/apikey) adresine girin
2. Google hesabınızla oturum açın
3. **Create API key** deyip anahtarı kopyalayın
4. Uzantı simgesine tıklayıp yapıştırın

Anahtar yapıştırıldığında token harcamayan bir doğrulama isteğiyle sınanır; yanlışsa
sebebini söyler (geçersiz / kota / yetki).

### Kaynaktan derleme

```bash
pnpm install
pnpm --filter extension build
```

`extension/dist` klasörünü `chrome://extensions` → Geliştirici modu → "Paketlenmemiş öğe
yükle" ile yükleyin. Firefox için:

```bash
HEDEF=firefox pnpm --filter extension build
```

Bu **`extension/dist-firefox`** üretir — Chrome'unki ayrı klasör. (İkisi aynı klasöre
yazdığı için Chrome'a sessizce Firefox paketi yüklenmesi bir kez başımıza geldi.)

## Desteklenen siteler

| Site | Durum |
|---|---|
| sahibinden.com | ✓ |
| arabam.com | ✓ |

Yeni site eklemek yaklaşık 130 satır — ayrıntı: [CONTRIBUTING.md](CONTRIBUTING.md)

## Nasıl çalışıyor

```
┌─ Tarayıcı ──────────────────────────────────────────┐
│ content script                                      │
│   · site adaptörü sayfayı okur (src/siteler/)       │
│   · panel ve skor rozetlerini çizer                 │
│   · liste satırlarını yerel depoya yazar            │
│   · anahtarı GÖRMEZ                                 │
│                                                     │
│ service worker             ┌────────────────────┐   │
│   · deterministik hesap    │ Google Gemini API  │   │
│   · PII maskesi         ──►│ kullanıcının kendi │   │
│   · analiz çağrısı         │ anahtarıyla        │   │
│   · anahtar burada durur   └────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

Panelde gördüğünüz sayıların çoğu yapay zekâdan gelmez. Fiyat medyanı, yüzdelik dilim,
pazarlık tabanı, kilometre değerlendirmesi ve liste skorları **deterministik olarak
hesaplanır** (`shared/src/stats.ts`, `km.ts`, `listeSkoru.ts`) — aynı girdi hep aynı
sayıyı verir ve testle sabitlenmiştir. Modele kalan iş özet, artı/eksi ve uyarı
cümleleridir.

## Depo düzeni

| Paket | İçerik |
|---|---|
| `extension/` | Uzantı: site adaptörleri, panel, service worker |
| `shared/` | Şemalar, deterministik hesaplar, PII maskesi, analiz hattı |
| `backend/` | Yalnızca statik gizlilik politikası sayfası (130 satır). Analiz akışında yer almaz |

## Geliştirme

```bash
pnpm install
pnpm -r test                    # tüm testler
pnpm -r exec tsc --noEmit       # tip denetimi
```

Testler gerçek sayfa yapılarından çıkarılmış fixture'lara bakar
(`extension/test/fixtures/`). Fixture'lardaki ilan numaraları, başlıklar ve satıcının
yazdığı serbest metinler **sentetiktir**; yalnız DOM yapısı gerçektir.

## Kapsam ve sorumluluk

İlan Analiz bağımsız bir üründür; üzerinde çalıştığı ilan siteleriyle herhangi bir
ortaklığı, iş birliği veya onay ilişkisi yoktur, onlar tarafından desteklenmez. Site ve
marka adları yalnız hangi sitede çalıştığını belirtmek için kullanılır; tüm markalar
ilgili sahiplerine aittir.

Proje, üzerinde çalıştığı sitelerin içeriğini bir yerde toplamaz, saklamaz, yeniden
yayınlamaz ve bir veri kümesi oluşturmaz. Okunan her şey kullanıcının kendi açtığı
sekmede kalır.

**İlan sitelerinin kendi kullanım koşulları sizin için geçerli olmaya devam eder.** Bazı
siteler, sayfalarının otomatik araçlarla okunmasına veya işlenmesine koşullarında sınır
getirir. Bu depo herhangi bir siteden alınmış izin ya da onay olduğunu iddia etmez;
kullanacağınız sitenin koşullarını okumak ve buna göre karar vermek size aittir.

Ürettiği değerlendirme bilgi amaçlıdır, yatırım veya satın alma tavsiyesi değildir ve
garanti içermez. Satın alma kararından önce aracı ekspertize gönderin.

## Lisans

[MIT](LICENSE) — garanti yoktur, sorumluluk kabul edilmez.
