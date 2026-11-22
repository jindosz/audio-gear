// eq.ts 테스트(EQ로 들어보기 계산). 실행: npm test
import { describe, expect, it } from 'vitest'
import { matchError, targetEq } from './eq'
import { FINE_GRID } from './similarity'

describe('matchError: EQ를 건 뒤 들어볼 기기와 남은 차이', () => {
  const flat = [
    { freq: 20, db: 0 },
    { freq: 20000, db: 0 },
  ]
  const bump = (at: number, db: number) =>
    Array.from({ length: 200 }, (_, i) => {
      const freq = 20 * 1000 ** (i / 199)
      return { freq, db: db * Math.exp(-((Math.log2(freq / at)) ** 2) * 4) }
    })
  it('똑같으면 0', () => {
    expect(matchError(flat, flat, FINE_GRID.map(() => 0))).toBeCloseTo(0, 6)
  })
  it('EQ 없이 모양이 다르면 0보다 큼, 차이를 그대로 EQ로 채우면 거의 0', () => {
    const wish = bump(2000, 6)
    const before = matchError(flat, wish, FINE_GRID.map(() => 0))
    expect(before).toBeGreaterThan(1)
    const exact = targetEq(flat, wish).map((v) => v ?? 0)
    expect(matchError(flat, wish, exact)).toBeLessThan(0.3)
  })
  it('8kHz 위 차이는 셈하지 않음', () => {
    expect(matchError(flat, bump(14000, 6), FINE_GRID.map(() => 0))).toBeLessThan(0.3)
  })
})
