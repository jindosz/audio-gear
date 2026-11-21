// earBalance.ts 테스트(내 귀 균형 계산). 실행: npm test
import { describe, expect, it } from 'vitest'
import { balanceLabel, channelAttenuation, randomStart, roundStep, summarize } from './earBalance'

describe('summarize: 6번 맞춘 값 → 결과', () => {
  it('평균을 0.5dB 단위로 반올림', () => {
    expect(summarize([2, 1, 2, 2, 1, 3])).toEqual({ db: 2, unstable: false, seeDoctor: false })
  })
  it('같은 주파수 두 값 차이가 3dB를 넘으면 들쭉날쭉', () => {
    expect(summarize([0, 0, 0, 4, 0, 0]).unstable).toBe(true)
  })
  it('차이가 딱 3dB면 괜찮음', () => {
    expect(summarize([0, 0, 0, 3, 0, 0]).unstable).toBe(false)
  })
  it('결과가 10dB 이상이면 진료 권유(왼쪽·오른쪽 모두)', () => {
    expect(summarize([10, 10, 10, 10, 10, 10]).seeDoctor).toBe(true)
    expect(summarize([-10, -10, -10, -10, -10, -10]).seeDoctor).toBe(true)
    expect(summarize([9, 9, 9, 9, 9, 9]).seeDoctor).toBe(false)
  })
})

describe('channelAttenuation: 큰 쪽만 줄인다', () => {
  it('양수(오른쪽을 키워야 가운데) → 왼쪽을 낮춤', () => {
    expect(channelAttenuation(1.5)).toEqual({ left: -1.5, right: 0 })
  })
  it('음수 → 오른쪽을 낮춤', () => {
    expect(channelAttenuation(-2)).toEqual({ left: 0, right: -2 })
  })
  it('0 → 그대로', () => {
    expect(channelAttenuation(0)).toEqual({ left: 0, right: 0 })
  })
})

describe('randomStart: 슬라이더 시작 위치', () => {
  it('언제나 ±3~6dB, 0.5 단위', () => {
    for (const r of [0, 0.25, 0.49, 0.5, 0.75, 0.99]) {
      const v = randomStart(() => r)
      expect(Math.abs(v)).toBeGreaterThanOrEqual(3)
      expect(Math.abs(v)).toBeLessThanOrEqual(6)
      expect(v * 2).toBe(Math.round(v * 2))
    }
  })
  it('왼쪽·오른쪽 둘 다 나온다', () => {
    expect(randomStart(() => 0.1)).toBeLessThan(0)
    expect(randomStart(() => 0.9)).toBeGreaterThan(0)
  })
})

describe('roundStep', () => {
  it('0.5 단위로, −12~+12 안으로', () => {
    expect(roundStep(1.3)).toBe(1.5)
    expect(roundStep(20)).toBe(12)
    expect(roundStep(-20)).toBe(-12)
  })
})

describe('balanceLabel', () => {
  it('문구', () => {
    expect(balanceLabel(0)).toBe('가운데')
    expect(balanceLabel(1.5)).toBe('왼쪽 1.5dB 낮춤')
    expect(balanceLabel(-1.5)).toBe('오른쪽 1.5dB 낮춤')
    expect(balanceLabel(-2)).toBe('오른쪽 2dB 낮춤')
  })
})
