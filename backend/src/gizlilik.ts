// Chrome Web Store gizlilik politikası URL'i ZORUNLU. Backend'in kalan TEK işi bu sayfa.
//
// Metin uzantının GERÇEKTE yaptığını anlatır. Mağaza incelemesi listelemedeki veri
// beyanlarıyla bu sayfayı ve manifest izinlerini karşılaştırıyor; üçü tutmazsa reddediliyor.
// Artık anlatılacak şey kısa: sunucu yok, hesap yok, toplanan veri yok.

const ILETISIM = process.env.ILETISIM_EPOSTA ?? 'destek@example.com'
// Gizlilik politikasında veri sorumlusunun kim olduğu açıkça yazmalı: mağaza incelemesi
// de, kullanıcı da "bu veriyi kim işliyor" sorusunun cevabını burada arıyor.
const SIRKET = process.env.SIRKET_ADI ?? 'Paff Studios'
const SIRKET_YER = process.env.SIRKET_YER ?? 'Delaware, ABD'
const GUNCELLEME = '18 Ağustos 2026'

export const GIZLILIK_HTML = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gizlilik Politikası — İlan Analiz</title>
<style>
:root { color-scheme: light dark;
  --zemin:#faf9f7; --yuzey:#fff; --metin:#241f1b; --metin2:#5f574f; --kenar:#e3ddd6; --vurgu:#2f7d4a }
@media (prefers-color-scheme: dark) { :root {
  --zemin:#191614; --yuzey:#221e1b; --metin:#f0ece7; --metin2:#a89f96; --kenar:#35302c; --vurgu:#4fb06a } }
* { box-sizing:border-box }
body { margin:0; background:var(--zemin); color:var(--metin); padding:48px 20px;
  font:16px/1.65 -apple-system,"Segoe UI",Roboto,sans-serif }
main { max-width:44rem; margin:0 auto }
h1 { font-size:1.6rem; line-height:1.25; margin:0 0 6px; text-wrap:balance }
.alt { color:var(--metin2); font-size:.85rem; margin:0 0 32px }
h2 { font-size:1.05rem; margin:34px 0 10px; padding-top:18px; border-top:1px solid var(--kenar) }
p, li { color:var(--metin2) }
li { margin-bottom:6px }
strong { color:var(--metin); font-weight:600 }
table { width:100%; border-collapse:collapse; margin:14px 0; font-size:.9rem; display:block; overflow-x:auto }
th,td { text-align:left; padding:9px 12px; border-bottom:1px solid var(--kenar); vertical-align:top }
th { color:var(--metin); font-weight:600; white-space:nowrap }
td { color:var(--metin2) }
.kutu { background:var(--yuzey); border:1px solid var(--kenar); border-left:3px solid var(--vurgu);
  border-radius:0 6px 6px 0; padding:14px 16px; margin:18px 0 }
.kutu p { margin:0; color:var(--metin) }
a { color:var(--vurgu) }
</style></head>
<body><main>
<h1>Gizlilik Politikası</h1>
<p class="alt">İlan Analiz (tarayıcı uzantısı) · ${SIRKET} · Son güncelleme: ${GUNCELLEME}</p>

<div class="kutu"><p><strong>Uzantı bize hiçbir veri göndermez.</strong> Analiz sizin
tarayıcınızda, sizin kendi yapay zekâ anahtarınızla üretilir. İlan bilgileri bize hiç
ulaşmaz; bizim saklayacağımız bir veri yoktur. Hesap açmanız da gerekmez. (Şu an
okuduğunuz bu sayfa bizim sunucumuzdan gelir; uzantının kendisi o sunucuya hiç
bağlanmaz.)</p></div>

<h2>Veri sorumlusu</h2>
<p>Uzantıyı geliştiren taraf <strong>${SIRKET}</strong> (${SIRKET_YER}).
Soru, erişim veya silme talebi için: <a href="mailto:${ILETISIM}">${ILETISIM}</a></p>
<p>İlan Analiz bağımsız bir üründür; üzerinde çalıştığı ilan siteleriyle herhangi bir
ortaklığı, bağlantısı veya onay ilişkisi yoktur.</p>

<h2>Tek amaç</h2>
<p>Uzantının tek amacı, <strong>sizin açtığınız araç ilanını değerlendirmektir</strong>:
kilometrenin yaşa göre konumu, benzer ilanlara göre fiyat konumu ve ilanın alıcı gözünden
özeti.</p>

<h2>Topladığımız veri</h2>
<p><strong>Hiçbiri.</strong> Bizim sunucumuza giden veri yok, bizde hesabınız yok, çerez
kullanmıyoruz, kullanım istatistiği toplamıyoruz. Uzantı yalnız sizin açtığınız ilan
sayfasını okur ve sonucu aynı sayfada gösterir.</p>

<h2>Tarayıcınızda saklananlar</h2>
<table>
<tr><th>Veri</th><th>Nerede</th><th>Neden</th></tr>
<tr><td>Yapay zekâ API anahtarınız</td><td>Yalnız tarayıcınızın uzantı deposunda</td>
    <td>Analiz çağrısını yapmak. <strong>Bize hiç gönderilmez</strong>; doğrudan yapay zekâ
        sağlayıcısına gider. İlan sayfasındaki koda da geçmez.</td></tr>
<tr><td>Açtığınız liste sayfalarının satırları (yıl, kilometre, fiyat)</td>
    <td>Tarayıcınızda, en fazla 24 saat</td>
    <td>Fiyat karşılaştırması. Yalnız sizin gördüğünüz sayfalardan gelir, ek istek yapılmaz.</td></tr>
<tr><td>Ürettiğiniz analizler</td><td>Tarayıcınızda, en fazla 24 saat</td>
    <td>Aynı ilanı tekrar açtığınızda yeniden üretilip size ücret çıkarmasın diye.</td></tr>
</table>
<p>Bunların hepsi sizin cihazınızda kalır ve uzantıyı kaldırdığınızda silinir.</p>

<h2>Yapay zekâ sağlayıcısına gidenler</h2>
<p>Analiz üretmek için ilanın metni, <strong>sizin anahtarınızla</strong> ve doğrudan
tarayıcınızdan Google Gemini API'ye gönderilir. Bu aktarım sizinle Google arasındadır;
biz aracı değiliz ve içeriği görmeyiz. Google'ın bu veriyi nasıl işlediği kendi
koşullarına tabidir.</p>
<p>Gönderilmeden önce metindeki <strong>telefon numarası, e-posta adresi, IBAN, T.C.
kimlik numarası ve plaka</strong> otomatik olarak maskelenir (yerine <code>[telefon]</code>
gibi bir işaret konur). Bu, ilan sahibinin kişisel verisini korumak içindir.</p>

<h2>Ödeme</h2>
<p>Uzantı ücretsizdir. Bizde ödeme alınmaz, kart bilgisi işlenmez, abonelik yoktur.
Yapay zekâ kullanımının bedeli varsa doğrudan sizin kendi sağlayıcı hesabınızdan işler.</p>

<h2>Haklarınız</h2>
<p>Bizde veriniz olmadığı için silinecek bir kaydımız da yok. Tarayıcınızda saklananları
uzantıyı kaldırarak veya uzantı penceresinden anahtarı silerek istediğiniz an
temizleyebilirsiniz. Soru için ${ILETISIM}.</p>

<h2>Değişiklikler</h2>
<p>Uygulamalar değişirse bu sayfa güncellenir ve değişiklik uzantı panelinde duyurulur.</p>
</main></body></html>`
