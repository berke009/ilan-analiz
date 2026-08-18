// Firefox ile Chrome arasındaki tek gerçek kod farkı: ad alanı ve promise davranışı.
// Firefox'ta `browser.*` promise döndürür, `chrome.*` ise Chrome uyumluluğu için
// callback tabanlıdır — yani `await chrome.storage.local.get(...)` Firefox'ta sessizce
// undefined verir. Chrome'da `browser` yoktur ve MV3'te `chrome.*` zaten promise döndürür.
//
// Proxy ile TEMBEL çözüyoruz: modül yüklenirken değil, her erişimde bakıyor. Testler
// globalThis.chrome'u import'tan sonra kurabildiği için bu şart.
export const tarayici: typeof chrome = new Proxy({} as typeof chrome, {
  get: (_h, alan) => ((globalThis as any).browser ?? (globalThis as any).chrome)?.[alan]
})
