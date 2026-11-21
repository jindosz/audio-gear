// soundTags.ts 테스트(성향 태그). 실행: npm test
import { describe, expect, it } from 'vitest'
import { SUMMARY_GRID } from './similarity'
import { soundTags, tagReferenceId } from './soundTags'

const flat = SUMMARY_GRID.map(() => 0)
/** 기준(0dB)에서 lo~hi Hz만 db만큼 올리거나 내린 곡선 */
const shaped = (lo: number, hi: number, db: number) => SUMMARY_GRID.map((f) => (f >= lo && f < hi ? db : 0))
const labels = (values: (number | null)[]) => soundTags(values, flat, SUMMARY_GRID, 'Harman').map((t) => t.label)

describe('soundTags', () => {
  it('기준과 같으면 "타깃에 가까움"', () => {
    expect(labels(flat)).toEqual(['타깃에 가까움'])
  })

  it('저음이 많거나 적으면', () => {
    expect(labels(shaped(60, 250, 5))).toEqual(['저음 강함'])
    expect(labels(shaped(60, 250, -5))).toEqual(['저음 약함'])
  })

  it('고음 밝음/어두움, 근거 문구', () => {
    const bright = soundTags(shaped(5000, 10000, 4), flat, SUMMARY_GRID, 'Harman')
    expect(bright[0]).toMatchObject({ label: '고음 밝음', kind: 'more' })
    expect(bright[0].detail).toBe('Harman 대비 5~10kHz +4.0dB')
    expect(labels(shaped(5000, 10000, -4))).toEqual(['고음 어두움'])
  })

  it('작은 차이(기준 미만)는 태그 없음, 평균 차이가 크면 "타깃에 가까움"도 아님', () => {
    expect(labels(shaped(60, 250, 2))).toEqual(['타깃에 가까움'])
    // 여러 대역이 조금씩 다르면 어느 태그에도 안 걸리지만 가깝다고도 하지 않는다
    const wavy = SUMMARY_GRID.map((f) => (f < 2000 ? 2.4 : -2.4))
    expect(labels(wavy)).toEqual([])
  })

  it('5~9kHz 좁은 피크는 "치찰음 피크"', () => {
    const peak = SUMMARY_GRID.map((f) => (f > 6500 && f < 7500 ? 8 : 0))
    expect(labels(peak)).toContain('치찰음 피크')
  })

  it('차이가 큰 순서로 최대 3개', () => {
    const many = SUMMARY_GRID.map((f) => (f < 60 ? 8 : f < 250 ? 9 : f < 800 ? 4 : f < 2000 ? 0 : f < 5000 ? -5 : f < 10000 ? -6 : 0))
    const result = labels(many)
    expect(result).toHaveLength(3)
    expect(result[0]).toBe('저음 강함')
  })
})

describe('tagReferenceId', () => {
  it('종류·리그에 맞는 타깃', () => {
    expect(tagReferenceId('headphone', 'gras')).toBe('autoeq:harman-oe-2018')
    expect(tagReferenceId('headphone', '5128')).toBe('autoeq:lmg-5128')
    expect(tagReferenceId('iem', '711')).toBe('autoeq:harman-ie-2019')
  })
})
