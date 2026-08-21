# Paylaşılan önbellek

Aynı ilanı birden çok kişi analiz ettiğinde herkesin kendi Gemini kotasını aynı iş için
harcaması gereksiz. Bu katman, **rıza veren** kullanıcılar arasında analiz **metnini**
paylaşır: sizden önce birinin ürettiği sonucu görürsünüz, sizin ürettiğiniz de aynı ilanı
açanlara gösterilir. Karşılıklıdır — katılmayan ne görür ne verir.

**Varsayılan olarak kapalıdır.** Bu depoyu klonlayıp `pnpm start` diyen biri, bu katman
hiç yokmuş gibi bir sunucu alır: rotalar 404 döndürmüyor, hiç kurulmuyor.

## Tasarım

Sunucu **vekil değil, yan yol**. Analiz akışının içine girmez:

```
┌─ Tarayıcı ─────────────────────────┐
│  1. yerel önbellek (24 saat)       │
│         ↓ yoksa                    │      ┌──────────────────┐
│  2. paylaşılan önbellek  ─────────────────►│ bizim sunucumuz  │  GET  (isabet → dur)
│         ↓ yoksa                    │      │  metin + 24s TTL │  POST (üretilen metin)
│  3. Gemini ────────────────────────────┐  └──────────────────┘
│         (KULLANICININ KENDİ ANAHTARI)  │
└────────────────────────────────────────┼─────────────────────┐
                                         ▼                     │
                              ┌────────────────────┐           │
                              │ Google Gemini API  │◄──────────┘
                              └────────────────────┘
```

Üçüncü adım her zaman **doğrudan** kullanıcının tarayıcısından, kullanıcının kendi
anahtarıyla gider. API anahtarı hiçbir koşulda bizim sunucumuza uğramaz.

### İki değişmez

**1. Yalnız metin paylaşılır, sayı paylaşılmaz.** Fiyat medyanı, yüzdelik dilim, pazarlık
hedefi ve kilometre değerlendirmesi okuyanın kendi cihazında yeniden hesaplanır
(`shared/src/onbellek.ts` → `birlestir`). Kötü niyetli bir kayıt en fazla yorum
cümlelerini kirletebilir; rakamlara ulaşamaz. Test: `shared/test/onbellek.test.ts`,
"SAYILAR paylaşılmaz" ve `extension/test/sw.test.ts`, "İSABETTE SAYILAR YERELDEN gelir".

**2. Katılım karşılıklı.** Anahtarı olmayan kullanıcı önbelleğe hiç bakmaz. Aksi hâlde
herkesin beklediği, kimsenin doldurmadığı bir önbellek olurdu.

### Önbellek anahtarı

`sha256(sürüm | site | ilanId | fiyat | model | istatistikDilimi)`

İlan adresi, başlığı ve satıcının açıklaması anahtara **girmez**; sunucu bu özetten
hangi ilan olduğunu çözemez.

`istatistikDilimi` neden var: fiyat yorumu, yazan kişinin kendi karşılaştırma örneklemine
bakarak üretiliyor. Örneklemi olmayan birine "medyanın %12 altında" cümlesini servis
etmek panelde çelişki yaratırdı — metin bir fiyat konumundan bahseder, üstündeki kutu
boştur. Bu yüzden istatistik durumu (yok / hangi ondalık dilim) anahtarın parçası.

`PAYLASIM_SURUM` prompt, şema veya paylaşılan alanların anlamı değiştiğinde artırılmalı:
eski kayıtlar yeni sürüme hiç eşleşmez ve TTL ile kendiliğinden düşer.

## Zehirlenmeye karşı

Paylaşılan bir metin kutusunun temel riski, birinin popüler bir ilana uydurma analiz
yazıp o ilanı açan herkese göstermesi. Katmanlar:

| Savunma | Nerede |
|---|---|
| Sayılar hiç paylaşılmaz — medyan, yüzdelik, pazarlık hedefi yerelde hesaplanır | `shared/src/onbellek.ts` |
| **İlk yazan kazanır**: kayıt TTL boyunca ezilemez (`SET NX`) | `backend/src/depo.ts` |
| Şema + alan alan uzunluk tavanı | `PaylasilanAnalizSchema` |
| Telefon/e-posta/IBAN/TCKN/plaka içeren kayıt reddedilir (maske metni değiştiriyorsa) | `backend/src/onbellek.ts` → `denetle` |
| Alan adı / bağlantı içeren kayıt reddedilir — reklam ilk kötüye kullanımdır | aynı yer |
| Yazma hız limiti: kimlik başına dakikada 30, günde 300 | `backend/src/limit.ts` |
| Panelde açık beyan: "başka bir kullanıcının anahtarıyla üretildi" | `extension/src/ui/Panel.tsx` |

Bu **tam koruma değildir**: geçerli görünen ama yanlış bir metin yazan biri, o ilanı
TTL boyunca kirletebilir. Etkisi bir ilanla ve 24 saatle sınırlı, sayılara ulaşamıyor ve
kullanıcıya sonucun başkasından geldiği söyleniyor. Daha güçlü seçenek iki bağımsız
kullanıcının mutabakatını beklemekti; tasarruf yarıya iniyor diye tercih edilmedi.

## Kurulum

### Sunucu

```bash
cp backend/.env.example backend/.env
# PAYLASIM_ACIK=1, CLOUDFLARE_TUNNEL_TOKEN=... doldurulur
docker compose -f backend/docker-compose.yml up -d
```

Üç servis kalkar: uygulama, Valkey ve Cloudflare tüneli. **Dışarıya açık port yoktur** —
tünel dışa doğru bağlanır, gelen bağlantı kabul etmez.

Valkey yerine bellek içi depo da kullanılabilir (`VALKEY_URL` boş bırakılır): tek
süreçlik küçük kurulum için yeterli, ama süreç yeniden başlayınca önbellek sıfırlanır ve
birden fazla örnek çalıştırılamaz.

### Cloudflare Tunnel

1. Zero Trust → Networks → Tunnels → Create a tunnel
2. Public hostname: `onbellek.<alanadınız>` → Service: `http://backend:3000`
3. Jetonu `backend/.env` içine `CLOUDFLARE_TUNNEL_TOKEN=` olarak yazın

Kenarda ayrıca yapılması önerilenler:

- **Rate limiting rule**: `/v1/onbellek` POST için IP başına dakikada ~60. Uygulamadaki
  limit ikinci hat; ilk hattı kenarda tutmak sunucuya hiç yük gelmemesini sağlar.
- **Cache rule**: `GET /v1/onbellek/*` için "Cache Everything" + "Respect origin TTL".
  Kayıtlar TTL boyunca değişmediği (ilk yazan kazanır) için bu güvenli ve okuma yükünü
  sunucudan tamamen alır. Uygulama isabet yanıtına
  `public, max-age=300, s-maxage=3600, stale-while-revalidate=600, stale-if-error=86400`
  yazıyor; sonuncusu sayesinde sunucu ya da tünel düştüğünde bile kenardaki kopya
  servis edilmeye devam eder.
- **WAF**: `/v1/*` dışındaki yolları ve `GET`/`POST`/`OPTIONS` dışındaki metotları kes.

### Worker gerekir mi?

Şu an **hayır**. Okuma yolu için Cache Rule ile Worker'ın yaptığı iş aynı: ikisi de aynı
kenar önbelleğini kullanıyor, Cache Rule kod istemiyor. Yazma yolu zaten önbelleklenemez
(her POST benzersiz bir kaydı yazıyor), yani Worker orada da bir şey kazandırmıyor.

Worker'ın gerçekten kazandıracağı üç durum var; ölçüp gördüğünüzde eklenir:

1. **Eşzamanlı isabetsizlik daraltma.** Cloudflare'ın her lokasyonu ayrı önbellek
   tutuyor; popüler bir ilan ilk kez okunduğunda onlarca lokasyondan aynı anda origin'e
   istek gelebilir. Worker'ın Cache API'siyle bunlar tek isteğe indirilebilir.
2. **Kenarda ucuz eleme.** Anahtar biçimi, kaynak denetimi ve kimlik başlığı kontrolü
   Worker'da yapılırsa bozuk istekler origin'e hiç ulaşmaz. Aynı işi WAF kuralları da
   büyük ölçüde yapıyor.
3. **404'leri kısa süreli kenarda tutmak.** Uygulama bunları bilerek `no-store`
   veriyor (birazdan dolabilir); Worker'da 10-20 saniyelik bir negatif önbellek,
   henüz kimsenin analiz etmediği ilanlarda origin'i rahatlatır.

Workers KV'yi kaynak deposu yapmak denenmemeli: yazma kotası (ücretsiz katmanda günde
1.000) tam olarak bizim yazma yolumuz ve yayılım gecikmesi ilk yazan kazanır kuralını
belirsizleştirir.

### IP başlığı — dikkat

Uygulama istemci IP'sini `IP_BASLIGI` (varsayılan `cf-connecting-ip`) başlığından okur.
Bu başlık **yalnız kendi vekiliniz yazıyorsa** güvenilir. Sunucu doğrudan internete
açıksa istemci başlığı uydurup IP limitini tamamen atlar — bu yüzden compose kurulumu
hiçbir portu yayınlamıyor ve `BIND` varsayılanı `127.0.0.1`.

### Uzantı

Adres **derleme zamanı sabiti**. Verilmeden derlenen pakette özellik yoktur: sabit boş
kalır, kod ölü daldır ve `optional_host_permissions` manifestten tamamen düşer.

```bash
PAYLASIM_KOK=https://onbellek.alanadiniz.com pnpm --filter extension build
```

Çalışma zamanı ayarı olsaydı, ele geçen bir depo değeriyle uzantı başka bir sunucuya
konuşabilir hâle gelirdi.

Kendi sunucusunu kuran biri kendi adresiyle derleyip kendi kullanıcı kitlesini
oluşturabilir; kurulumlar birbirine bağlı değildir.

## Uçlar

| Uç | Ne yapar |
|---|---|
| `GET /v1/onbellek/:anahtar` | 64 hex karakterlik anahtarın kaydını döner. 404 = isabetsizlik (önbelleğe alınmaz). |
| `POST /v1/onbellek` | `{anahtar, analiz}` yazar. 201 yazıldı, 200 zaten vardı, 422 denetimden geçmedi, 429 limit. |
| `GET /health` | `paylasim` alanı katmanın açık olup olmadığını söyler. |

Sunucu **analiz üretmez**, model çağırmaz, API anahtarı görmez.

## Kullanıcı ne görür

Uzantı penceresinde "Paylaşılan önbellek" bölümü, iki yönü de yazan bir metinle: ne
alıyorsun, ne veriyorsun. Açmak için hem bu onay hem tarayıcının izin sorusu gerekiyor.
Çıkarken tarayıcı izni geri alınır ve istemci numarası silinir.

Paylaşılan bir sonuç panele basıldığında üstünde şu yazar: bu değerlendirme başka bir
kullanıcının kendi anahtarıyla N saat önce üretildi, fiyat konumu ve pazarlık hedefi
senin kendi verinle hesaplandı.
