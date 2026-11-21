// listHeight.ts 테스트(폰 화면 아래 목록 시트의 높이·자리). 실행: npm test
import { describe, expect, it } from 'vitest'
import { clampListHeight, releaseSnap, sheetSnaps, tapSnap } from './listHeight'

// 화면 높이 800px, 손잡이 36px → 접힘 36, 중간 360(45%), 펼침 704(88%)
const snaps = sheetSnaps(800, 36)

describe('sheetSnaps: 세 자리', () => {
  it('접힘 = 손잡이 높이, 중간 = 45%, 펼침 = 88%', () => {
    expect(snaps).toEqual({ collapsed: 36, middle: 360, top: 704 })
  })
  it('높이 700px 이하 폰은 중간이 38%(CSS --list-base와 같게)', () => {
    expect(sheetSnaps(700, 24).middle).toBe(266)
  })
  it('메뉴 줄 아래 끝을 주면 펼침 = 메뉴 줄 바로 아래까지(틈 6px)', () => {
    expect(sheetSnaps(839, 48, 56).top).toBe(839 - 56 - 6)
  })
  it('메뉴 줄이 너무 커도 펼침은 중간보다 높게', () => {
    expect(sheetSnaps(400, 36, 300).top).toBeGreaterThan(sheetSnaps(400, 36, 300).middle)
  })
})

describe('clampListHeight: 끄는 중', () => {
  it('범위 안이면 그대로(정수로)', () => {
    expect(clampListHeight(400.4, snaps)).toBe(400)
  })
  it('접힘보다 낮게, 펼침보다 높게는 안 감', () => {
    expect(clampListHeight(0, snaps)).toBe(36)
    expect(clampListHeight(10000, snaps)).toBe(704)
  })
})

describe('releaseSnap: 놓았을 때', () => {
  it('천천히 놓으면 가장 가까운 자리', () => {
    expect(releaseSnap(100, 0, snaps)).toBe(36)
    expect(releaseSnap(300, 0.1, snaps)).toBe(360)
    expect(releaseSnap(600, -0.1, snaps)).toBe(704)
  })
  it('위로 툭 밀면 위쪽 다음 자리', () => {
    expect(releaseSnap(370, 0.8, snaps)).toBe(704) // 중간에서 조금 올리고 툭 → 펼침
    expect(releaseSnap(60, 0.8, snaps)).toBe(360) // 접힘 근처에서 툭 → 중간
  })
  it('아래로 툭 내리면 아래쪽 다음 자리', () => {
    expect(releaseSnap(340, -0.8, snaps)).toBe(36) // 중간에서 조금 내리고 툭 → 접힘
    expect(releaseSnap(680, -0.8, snaps)).toBe(360) // 펼침 근처에서 툭 → 중간
  })
  it('끝에서 더 밀면 끝 자리', () => {
    expect(releaseSnap(704, 1, snaps)).toBe(704)
    expect(releaseSnap(36, -1, snaps)).toBe(36)
  })
})

describe('tapSnap: 누르기만 했을 때', () => {
  it('접힘 → 중간, 중간 → 펼침, 펼침 → 중간', () => {
    expect(tapSnap(36, snaps)).toBe(360)
    expect(tapSnap(360, snaps)).toBe(704)
    expect(tapSnap(704, snaps)).toBe(360)
  })
})
