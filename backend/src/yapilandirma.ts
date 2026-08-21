import { VARSAYILAN_LIMIT, DAKIKA, GUN, type Kural } from './limit'

// PAYLAŞILAN ÖNBELLEK VARSAYILAN OLARAK KAPALIDIR.
//
// Bu bir çekingenlik değil, ürünün duruşu: bu depoyu klonlayıp `pnpm start` diyen
// biri bugünkü davranışın AYNISINI almalı — yalnız gizlilik sayfası sunan, veri
// görmeyen bir sunucu. Önbellek uçları ancak operatör açıkça PAYLASIM_ACIK=1 dediğinde
// var olur; kapalıyken 404 döndürmüyoruz, rotayı hiç KURMUYORUZ.
export type Ayar = {
  acik: boolean
  valkeyUrl: string
  ttlSn: number
  izinliOriginler: string[]
  ipBasligi: string
  govdeSiniriBayt: number
  limit: {
    okumaKimlik: Kural[]; yazmaKimlik: Kural[]
    okumaIp: Kural[]; yazmaIp: Kural[]; yazmaGenel: Kural[]
  }
}

const sayi = (v: string | undefined, varsayilan: number): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : varsayilan
}

export function ayarOku(ortam: NodeJS.ProcessEnv = process.env): Ayar {
  return {
    acik: ortam.PAYLASIM_ACIK === '1',
    // Boş bırakılırsa bellek içi depo kullanılır: tek süreçlik küçük kurulumlar için
    // yeterli, ama süreç yeniden başlayınca önbellek sıfırlanır ve birden fazla
    // örnek çalıştırılamaz. Üretimde Valkey verilmeli.
    valkeyUrl: ortam.VALKEY_URL ?? '',
    // 24 saat: uzantının yerel önbelleğiyle aynı. İkisi ayrışırsa kullanıcı aynı
    // ilanda bir gün eski, bir gün yeni sonuç görür ve sebebini anlayamaz.
    ttlSn: sayi(ortam.ONBELLEK_TTL_SN, 24 * 3600),
    // Boş liste = yalnız uzantı kaynakları (chrome-extension:// ve moz-extension://)
    // kabul edilir. Bir web sayfasının kaynağı asla kabul edilmez: kullanıcıların
    // tarayıcısı üzerinden yazma ucunu döven bir siteyi engelleyen tek şey bu.
    izinliOriginler: (ortam.IZINLI_ORIGIN ?? '').split(',').map(s => s.trim()).filter(Boolean),
    // İstemci IP'sini HANGİ başlıktan okuyacağımız. Varsayılan Cloudflare Tunnel
    // kurulumu. DİKKAT: bu başlık yalnız KENDİ vekilin yazıyorsa güvenilir —
    // sunucu doğrudan internete açıksa istemci bu başlığı uydurup IP limitini
    // tamamen atlar. Tünel arkasında 127.0.0.1'e bind etmek bu yüzden şart.
    ipBasligi: (ortam.IP_BASLIGI ?? 'cf-connecting-ip').toLowerCase(),
    // Şema zaten alan alan sınırlıyor; bu, ayrıştırıcıya hiç ulaşmadan devasa
    // gövdeleri kesen kaba filtre.
    govdeSiniriBayt: sayi(ortam.GOVDE_SINIRI_BAYT, 16 * 1024),
    limit: {
      okumaKimlik: [
        { adet: sayi(ortam.LIMIT_OKUMA_DK, VARSAYILAN_LIMIT.okumaKimlik[0]!.adet), pencereSn: DAKIKA },
        { adet: sayi(ortam.LIMIT_OKUMA_GUN, VARSAYILAN_LIMIT.okumaKimlik[1]!.adet), pencereSn: GUN }
      ],
      yazmaKimlik: [
        { adet: sayi(ortam.LIMIT_YAZMA_DK, VARSAYILAN_LIMIT.yazmaKimlik[0]!.adet), pencereSn: DAKIKA },
        { adet: sayi(ortam.LIMIT_YAZMA_GUN, VARSAYILAN_LIMIT.yazmaKimlik[1]!.adet), pencereSn: GUN }
      ],
      okumaIp: [{ adet: sayi(ortam.LIMIT_OKUMA_IP_DK, VARSAYILAN_LIMIT.okumaIp[0]!.adet), pencereSn: DAKIKA }],
      yazmaIp: [{ adet: sayi(ortam.LIMIT_YAZMA_IP_DK, VARSAYILAN_LIMIT.yazmaIp[0]!.adet), pencereSn: DAKIKA }],
      yazmaGenel: [{ adet: sayi(ortam.LIMIT_YAZMA_GENEL_SAAT, VARSAYILAN_LIMIT.yazmaGenel[0]!.adet), pencereSn: 3600 }]
    }
  }
}
