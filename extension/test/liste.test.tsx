import { describe, it, expect } from 'vitest'
import { chunk, rozetBas, LISTE_STIL } from '../src/ui/liste'

describe('chunk', () => {
  it('20’şerli böler', () => {
    expect(chunk(Array(45).fill(0), 20).map(c => c.length)).toEqual([20, 20, 5])
    expect(chunk([], 20)).toEqual([])
  })
})

describe('rozetBas', () => {
  function satirYap(): Element {
    document.body.innerHTML = '<table><tr data-id="7"><td class="ilk">resim</td><td>başlık</td></tr></table>'
    return document.querySelector('tr')!
  }
  it('skora göre renk sınıfı ve rozet', () => {
    const tr = satirYap()
    rozetBas(tr, { ilanId: '7', skor: 8.2, etiketler: ['İyi'], tekCumle: 'Temiz.' }, () => {})
    expect(tr.classList.contains('aa-yesil')).toBe(true)
    expect(tr.querySelector('.aa-rozet')?.textContent).toBe('8.2')
  })
  it('düşük skor kırmızı', () => {
    const tr = satirYap()
    rozetBas(tr, { ilanId: '7', skor: 4.9, etiketler: [], tekCumle: '' }, () => {})
    expect(tr.classList.contains('aa-kirmizi')).toBe(true)
  })
  it('rozet tıklanınca kart açılır', () => {
    const tr = satirYap()
    let acilan: any = null
    rozetBas(tr, { ilanId: '7', skor: 6, etiketler: [], tekCumle: '' }, s => { acilan = s })
    ;(tr.querySelector('.aa-rozet') as HTMLElement).click()
    expect(acilan?.ilanId).toBe('7')
  })
})

describe('rozetBas görünüme göre doğru hücreyi bulur', () => {
  const skor: any = { ilanId: '1', skor: 8.2, etiketler: [], tekCumle: 'iyi' }

  it('klasik satırda ilk td', () => {
    document.body.innerHTML = '<table><tr data-id="1"><td class="searchResultsLargeThumbnail"></td><td>x</td></tr></table>'
    const tr = document.querySelector('tr')!
    rozetBas(tr, skor, () => {})
    expect(tr.classList.contains('aa-yesil')).toBe(true)
    expect(tr.querySelector('td.searchResultsLargeThumbnail .aa-rozet')?.textContent).toBe('8.2')
  })

  it('galeri kartında (satırın kendisi td) içteki thumbnail hücresine basar', () => {
    document.body.innerHTML =
      '<table><tr><td data-id="1" class="searchResultsGalleryItem"><table><tr>' +
      '<td class="searchResultsLargeThumbnail"></td><td class="searchResultsGalleryContent"></td>' +
      '</tr></table></td></tr></table>'
    const kart = document.querySelector('td.searchResultsGalleryItem')!
    rozetBas(kart, skor, () => {})
    expect(kart.classList.contains('aa-yesil')).toBe(true)
    expect(kart.querySelector('.searchResultsLargeThumbnail .aa-rozet')?.textContent).toBe('8.2')
    expect(kart.querySelectorAll('.aa-rozet')).toHaveLength(1)
  })

  it('iki kez çağrılınca rozet çoğalmaz', () => {
    document.body.innerHTML = '<table><tr data-id="1"><td class="searchResultsLargeThumbnail"></td></tr></table>'
    const tr = document.querySelector('tr')!
    rozetBas(tr, skor, () => {})
    rozetBas(tr, skor, () => {})
    expect(tr.querySelectorAll('.aa-rozet')).toHaveLength(1)
  })

  it('galeri kartı da renklenir — CSS td.aa-* kuralını içerir', () => {
    expect(LISTE_STIL).toContain('td.aa-yesil')
    expect(LISTE_STIL).toContain('td.aa-kirmizi')
  })
})
