// listHeight.ts 테스트(폰 화면 목록 높이). 실행: npm test
import { describe, expect, it } from 'vitest'
import { LIST_MIN_PX, clampListHeight, tapTarget } from './listHeight'

describe('clampListHeight: 끌어서 정한 높이를 범위 안으로', () => {
  it('범위 안이면 그대로(정수로)', () => {
    expect(clampListHeight(400.4, 800)).toBe(400)
  })
  it('최소는 LIST_MIN_PX(검색창까지 보이는 높이)', () => {
    expect(LIST_MIN_PX).toBe(150)
    expect(clampListHeight(20, 800)).toBe(150)
  })
  it('목록 위쪽 부품(손잡이·헤드폰/이어폰·검색창)이 더 높으면 그 높이가 최소', () => {
    expect(clampListHeight(20, 800, 190)).toBe(190)
    expect(clampListHeight(20, 800, 100)).toBe(150) // 기본 최소보다 낮게는 안 내려감
  })
  it('최대는 화면 높이의 88%', () => {
    expect(clampListHeight(10000, 800)).toBe(704)
  })
})

describe('tapTarget: 손잡이를 끌지 않고 눌렀을 때', () => {
  it('목록이 화면의 60%보다 낮으면 80%로 펼친다', () => {
    expect(tapTarget(300, 800)).toBe(640)
  })
  it('60% 이상이면 기본 높이로(null = CSS 기본값)', () => {
    expect(tapTarget(640, 800)).toBeNull()
    expect(tapTarget(480, 800)).toBeNull()
  })
})
