import { describe, it, expect } from 'vitest'
import { medyan, yuzdelik, pazarlikTabani, clampPazarlik, fiyatIstatistik } from '../src/stats'

describe('stats', () => {
  it('medyan tek/çift', () => {
    expect(medyan([1, 3, 2])).toBe(2)
    expect(medyan([1, 2, 3, 4])).toBe(2.5)
  })
  it('yüzdelik', () => {
    expect(yuzdelik([100, 200, 300, 400], 250)).toBe(50)
    expect(yuzdelik([100, 200], 100)).toBe(0)
  })
  it('pazarlık tabanı: pahalı ilan → medyan, ucuz ilan → %5 altı', () => {
    expect(pazarlikTabani(1500000, 1375000)).toBe(1375000)
    expect(pazarlikTabani(1300000, 1375000)).toBe(1235000)
  })
  it('clamp ±%5', () => {
    expect(clampPazarlik(2000000, 1000000)).toBe(1050000)
    expect(clampPazarlik(900000, 1000000)).toBe(950000)
    expect(clampPazarlik(1020000, 1000000)).toBe(1020000)
    expect(clampPazarlik(null, 1000000)).toBe(1000000)
  })
  it('fiyatIstatistik n<5 → null', () => {
    expect(fiyatIstatistik([1, 2, 3, 4], 2)).toBe(null)
    const f = fiyatIstatistik([100, 200, 300, 400, 500], 300)
    expect(f).toMatchObject({ medyan: 300, n: 5, yuzdelik: 50 })
  })
})
