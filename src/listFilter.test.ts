// listFilter.ts 테스트. 실행: npm test
import { describe, expect, it } from 'vitest'
import { EMPTY_FILTER, activeCount, matchesFilter, measurerOptions, type FilterInfo } from './listFilter'

const info = (measurers: string[]): FilterInfo => ({ brandKey: 'sennheiser', specs: undefined, measurers: new Set(measurers) })

describe('측정자 필터', () => {
  it('고른 측정자의 측정치가 있는 기기만 남긴다', () => {
    const f = { ...EMPTY_FILTER, measurer: 'AutoEQ · oratory1990' }
    expect(matchesFilter(info(['AutoEQ · oratory1990', 'AutoEQ · Rtings']), f)).toBe(true)
    expect(matchesFilter(info(['AutoEQ · Rtings']), f)).toBe(false)
    expect(matchesFilter(info([]), f)).toBe(false)
  })

  it('측정자를 고르지 않으면 측정자로 거르지 않는다', () => {
    expect(matchesFilter(info([]), EMPTY_FILTER)).toBe(true)
  })

  it('켜진 필터 개수에 측정자도 센다', () => {
    expect(activeCount({ ...EMPTY_FILTER, measurer: 'AutoEQ · oratory1990' })).toBe(1)
  })

  it('측정자 선택지는 기기 수가 많은 순, 같으면 이름순', () => {
    const options = measurerOptions([
      new Set(['AutoEQ · Rtings', 'AutoEQ · oratory1990']),
      new Set(['AutoEQ · oratory1990']),
      new Set(['squig.link · Banbeucmas']),
    ])
    expect(options).toEqual([
      { key: 'AutoEQ · oratory1990', label: 'AutoEQ · oratory1990', count: 2 },
      { key: 'AutoEQ · Rtings', label: 'AutoEQ · Rtings', count: 1 },
      { key: 'squig.link · Banbeucmas', label: 'squig.link · Banbeucmas', count: 1 },
    ])
  })
})
