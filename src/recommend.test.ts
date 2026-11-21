// recommend.ts 테스트(추천 결과 특징 필터). 실행: npm test
import { describe, expect, it } from 'vitest'
import { EMPTY_FILTER } from './listFilter'
import { candidateMatches, recommend, type Candidate, type Reference } from './recommend'
import { SUMMARY_GRID } from './similarity'
import type { Device } from './types'

const flat = SUMMARY_GRID.map(() => 0)
const ref: Reference = { values: flat, category: 'headphone', rig: 'gras', source: 'AutoEQ · oratory1990' }

const candidate = (name: string, offset: number, device?: Partial<Device>): Candidate => ({
  name,
  category: 'headphone',
  source: 'AutoEQ · oratory1990',
  rig: 'gras',
  values: SUMMARY_GRID.map(() => offset),
  device: device ? ({ id: name, brand: '', model: name, category: 'headphone', owned: false, notes: '', createdAt: 0, ...device } as Device) : undefined,
})

describe('candidateMatches', () => {
  it('필터가 없으면 모두 통과', () => {
    expect(candidateMatches(candidate('Unknown X1', 0), EMPTY_FILTER)).toBe(true)
  })

  it('이름으로 추정한 특징으로 거른다(HD 600 = 유선·오픈형)', () => {
    const hd600 = candidate('Sennheiser HD 600', 0)
    expect(candidateMatches(hd600, { ...EMPTY_FILTER, connection: 'wired' })).toBe(true)
    expect(candidateMatches(hd600, { ...EMPTY_FILTER, connection: 'wireless' })).toBe(false)
    expect(candidateMatches(hd600, { ...EMPTY_FILTER, acoustic: 'open' })).toBe(true)
    expect(candidateMatches(hd600, { ...EMPTY_FILTER, acoustic: 'closed' })).toBe(false)
  })

  it('내 기기에 입력해 둔 특징이 추정값보다 먼저', () => {
    const mine = candidate('Sennheiser HD 600', 0, { connection: 'wireless', anc: true })
    expect(candidateMatches(mine, { ...EMPTY_FILTER, connection: 'wireless', anc: true })).toBe(true)
  })

  it('특징을 모르는 후보는 필터를 켜면 빠진다', () => {
    expect(candidateMatches(candidate('Unknown X1', 0), { ...EMPTY_FILTER, anc: true })).toBe(false)
  })

  it('브랜드·측정자 값은 무시한다', () => {
    expect(candidateMatches(candidate('Unknown X1', 0), { ...EMPTY_FILTER, brand: 'sony', measurer: 'x' })).toBe(true)
  })
})

describe('recommend + 필터', () => {
  it('묶음마다 자르기 전에 거른다(가까운 후보가 걸러져도 다음 후보가 채운다)', () => {
    const list = [candidate('Unknown X1', 0.1), candidate('Unknown X2', 0.2), candidate('Sennheiser HD 600', 1)]
    const wired = recommend(ref, list, 1, (c) => candidateMatches(c, { ...EMPTY_FILTER, connection: 'wired' }))
    expect(wired.map((r) => r.candidate.name)).toEqual(['Sennheiser HD 600'])
    expect(recommend(ref, list, 1).map((r) => r.candidate.name)).toEqual(['Unknown X1'])
  })
})
