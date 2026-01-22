import { describe, it, expect } from 'vitest'
import { binomialCoeff } from './combinatorics'

describe('binomialCoeff', () => {
  it('returns 1 for C(n, 0) and C(n, n)', () => {
    expect(binomialCoeff(5, 0)).toBe(1)
    expect(binomialCoeff(5, 5)).toBe(1)
  })

  it('calculates C(5, 2) = 10', () => {
    expect(binomialCoeff(5, 2)).toBe(10)
  })

  it('calculates C(10, 3) = 120', () => {
    expect(binomialCoeff(10, 3)).toBe(120)
  })

  it('returns 0 for invalid inputs', () => {
    expect(binomialCoeff(3, 5)).toBe(0)
    expect(binomialCoeff(5, -1)).toBe(0)
  })
})
