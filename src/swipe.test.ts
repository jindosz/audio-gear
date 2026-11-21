// swipe.ts 테스트(비교 탭 옆으로 밀어 넘기기). 실행: npm test
import { describe, expect, it } from 'vitest'
import { neighborTab, swipeStep } from './swipe'

describe('swipeStep: 빠르게 옆으로 툭 민 것만', () => {
  it('왼쪽으로 빠르게 → 다음 탭(+1), 오른쪽으로 → 이전 탭(−1)', () => {
    expect(swipeStep(-120, 10, 150)).toBe(1)
    expect(swipeStep(120, -10, 150)).toBe(-1)
  })
  it('짧으면(60px 미만) 아님', () => {
    expect(swipeStep(-50, 0, 50)).toBe(0)
  })
  it('천천히 끌면 아님(그래프 값 보기)', () => {
    expect(swipeStep(-200, 0, 1000)).toBe(0)
  })
  it('위아래로 더 많이 움직였으면 아님(스크롤)', () => {
    expect(swipeStep(-80, 60, 100)).toBe(0)
  })
})

describe('neighborTab', () => {
  const ids = ['a', 'b', 'c']
  it('다음·이전', () => {
    expect(neighborTab(ids, 'b', 1)).toBe('c')
    expect(neighborTab(ids, 'b', -1)).toBe('a')
  })
  it('끝에서는 넘어가지 않음', () => {
    expect(neighborTab(ids, 'c', 1)).toBeNull()
    expect(neighborTab(ids, 'a', -1)).toBeNull()
  })
  it('탭이 하나거나 모르는 탭이면 없음', () => {
    expect(neighborTab(['a'], 'a', 1)).toBeNull()
    expect(neighborTab(ids, 'x', 1)).toBeNull()
  })
})
