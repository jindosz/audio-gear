// sameMeasurer.ts 테스트(EQ로 들어보기: 같은 측정자로 맞추기). 실행: npm test
import { describe, expect, it } from 'vitest'
import { pickCommonSource } from './sameMeasurer'

const side = (current: string, saved: string[], available: string[] = []) => ({ current, saved, available })

describe('pickCommonSource', () => {
  it('둘 다 이미 저장된 측정자가 있으면 받지 않고 그걸로', () => {
    const r = pickCommonSource(side('A', ['A', 'B']), side('C', ['C', 'B'], ['A']))
    expect(r).toEqual({ source: 'B', fetchCurrent: false, fetchWish: false })
  })
  it('받을 게 적은 쪽(한쪽만 받기)을 먼저', () => {
    const r = pickCommonSource(side('A', ['A'], ['B']), side('C', ['C'], ['A', 'B']))
    expect(r).toEqual({ source: 'A', fetchCurrent: false, fetchWish: true })
  })
  it('받는 개수가 같으면 지금 쓰는 기기의 측정자 먼저', () => {
    const r = pickCommonSource(side('A', ['A', 'B']), side('C', ['C'], ['A', 'B']))
    expect(r?.source).toBe('A')
  })
  it('둘 다 받아야 하면 그래도 찾음', () => {
    const r = pickCommonSource(side('A', ['A'], ['X']), side('C', ['C'], ['X']))
    expect(r).toEqual({ source: 'X', fetchCurrent: true, fetchWish: true })
  })
  it('겹치는 측정자가 없으면 null', () => {
    expect(pickCommonSource(side('A', ['A'], ['B']), side('C', ['C'], ['D']))).toBeNull()
  })
})
