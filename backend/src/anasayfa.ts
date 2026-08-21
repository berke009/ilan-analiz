// Paylaşılan önbellek adresinin kök sayfası.
//
// Bu adres public bir uçtur ve er ya da geç birileri tarayıcıyla açacak: tarama
// yapan biri, meraklı bir kullanıcı, mağaza incelemecisi. Boş bir 404 karşılamak
// "burada ne dönüyor" sorusunu cevapsız bırakır ve gizlenmeye çalışılan bir şey
// varmış izlenimi verir. Uçları ve neyin saklandığını açıkça yazmak hem doğru
// hem de en ucuz güven işareti.
//
// Sayfa YALNIZ paylaşım açıkken kurulur; kapalı bir sunucuda kök adres, bugün
// olduğu gibi 404 döner.

export const ANASAYFA_HTML = (depoUrl: string, ttlSn: number) => `<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>İlan Analiz — paylaşılan önbellek</title>
<meta name="robots" content="noindex">
<style>
:root { color-scheme: light dark;
  --zemin:#faf9f7; --yuzey:#fff; --metin:#241f1b; --metin2:#5f574f; --kenar:#e3ddd6; --vurgu:#2f7d4a }
@media (prefers-color-scheme: dark) { :root {
  --zemin:#191614; --yuzey:#221e1b; --metin:#f0ece7; --metin2:#a89f96; --kenar:#35302c; --vurgu:#4fb06a } }
* { box-sizing:border-box }
body { margin:0; background:var(--zemin); color:var(--metin); padding:48px 20px;
  font:16px/1.65 -apple-system,"Segoe UI",Roboto,sans-serif }
main { max-width:46rem; margin:0 auto }
h1 { font-size:1.5rem; line-height:1.25; margin:0 0 6px }
.alt { color:var(--metin2); font-size:.9rem; margin:0 0 30px }
h2 { font-size:1rem; margin:32px 0 10px; padding-top:16px; border-top:1px solid var(--kenar) }
p, li, td { color:var(--metin2) }
strong { color:var(--metin); font-weight:600 }
code { font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; background:var(--yuzey);
  border:1px solid var(--kenar); border-radius:4px; padding:1px 5px; color:var(--metin) }
table { width:100%; border-collapse:collapse; margin:12px 0; font-size:.9rem; display:block; overflow-x:auto }
th,td { text-align:left; padding:8px 12px; border-bottom:1px solid var(--kenar); vertical-align:top }
th { color:var(--metin); font-weight:600; white-space:nowrap }
.kutu { background:var(--yuzey); border:1px solid var(--kenar); border-left:3px solid var(--vurgu);
  border-radius:0 6px 6px 0; padding:14px 16px; margin:18px 0 }
.kutu p { margin:0; color:var(--metin) }
a { color:var(--vurgu) }
</style></head><body><main>

<h1>İlan Analiz — paylaşılan önbellek</h1>
<p class="alt">İlan Analiz tarayıcı uzantısının isteğe bağlı önbellek katmanı.</p>

<div class="kutu"><p>Bu sunucu <strong>analiz üretmez</strong>: model çağırmaz, API anahtarı
görmez, ilan içeriği almaz. Tek işi, uzantı kullanıcılarının kendi anahtarlarıyla
ürettiği analiz <strong>metnini</strong> ${Math.round(ttlSn / 3600)} saat boyunca tutup
aynı ilanı açan diğer katılımcılara vermek. Katılım gönüllü ve karşılıklıdır: uzantı
kurulumunda açıkça sorulur ve kullanıcı tarayıcının izin penceresini onaylamadan bu
adrese <strong>hiçbir istek gitmez</strong>.</p></div>

<h2>Ne saklanıyor</h2>
<table>
<tr><th>Saklanan</th><th>Saklanmayan</th></tr>
<tr><td>Analiz metni: skor, durum etiketi, özet, artı/eksi maddeleri, uyarı cümleleri</td>
    <td>Kullanıcıların yapay zekâ API anahtarları</td></tr>
<tr><td>İlan numarası ve fiyattan türetilen SHA-256 özeti. Geri çevrilemez; bu sunucu
        özetten hangi ilan olduğunu çözemez.</td>
    <td>İlanın adresi, başlığı, satıcının yazdığı açıklama</td></tr>
<tr><td>Hız limiti için rastgele üretilmiş istemci numarası (hesap değil)</td>
    <td>Ad, e-posta, hesap, çerez, kullanım istatistiği</td></tr>
</table>
<p>Kayıtlar ${Math.round(ttlSn / 3600)} saat sonra otomatik silinir. Yazma sırasında metin
denetlenir: telefon, e-posta, IBAN, T.C. kimlik numarası, plaka veya bağlantı içeren
kayıtlar reddedilir.</p>

<h2>Uçlar</h2>
<table>
<tr><th>Uç</th><th>Davranış</th></tr>
<tr><td><code>GET /v1/onbellek/:anahtar</code></td>
    <td>64 karakterlik hex anahtarın kaydını döner. <code>404</code> = kayıt yok
        (bu yanıt önbelleğe alınmaz).</td></tr>
<tr><td><code>POST /v1/onbellek</code></td>
    <td><code>{anahtar, analiz}</code> yazar. <code>201</code> yazıldı ·
        <code>200</code> zaten vardı ya da itiraz kaydedildi ·
        <code>422</code> denetimden geçmedi · <code>429</code> hız limiti.</td></tr>
<tr><td><code>GET /health</code></td><td>Durum ve sürüm damgası.</td></tr>
<tr><td><code>GET /gizlilik</code></td><td>Gizlilik politikası.</td></tr>
</table>
<p>Kayıtlar <strong>ilk yazan kazanır</strong> kuralıyla yazılır: mevcut bir kaydın
üstüne yazılamaz. Ayrışan skorlarla gelen ikinci yazmalar itiraz sayılır ve iki itiraz
biriken kayıt silinir.</p>

<h2>Uzantıyı nereden alırım</h2>
<p>Paketler <a href="${depoUrl}/releases" rel="noopener">deponun sürümler sayfasından</a>
ve mağaza listelemesinden dağıtılır. <strong>Bu adres uzantı paketi sunmaz</strong> ve
sunmayacak. Burası bir metin önbelleği; ele geçirilse en fazla bir analiz yorumunu
kirletebilir. Aynı adresten çalıştırılabilir paket dağıtsaydık, ele geçirilmesi
kullanıcılara doğrudan kötü niyetli bir uzantı göndermek anlamına gelirdi ve o uzantı
API anahtarlarına erişebilirdi. İki işi ayrı tutmak bu yüzden bilinçli.</p>
<p>İndirdiğiniz paketi doğrulamak için kaynaktan derleyip karşılaştırabilirsiniz;
derleme gizli bir değer istemez.</p>

<h2>Kaynak kodu</h2>
<p>Uzantının ve bu sunucunun tamamı açık kaynak:
<a href="${depoUrl}" rel="noopener">${depoUrl}</a><br>
Katmanın tasarımı, zehirlenme savunmaları ve kendi sunucunuzu kurma adımları:
<code>docs/paylasilan-onbellek.md</code></p>

</main></body></html>`
