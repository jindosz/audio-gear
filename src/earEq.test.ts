// earEq.ts 테스트(내 귀 보정 계산). 실행: npm test
import { describe, expect, it } from 'vitest'
import { boosts, deviceOffset, ISO226_TF, layerCurve, relativeLoss } from './earEq'

const FREQS = [125, 250, 500, 1000, 2000, 4000, 8000]
/** 정상 귀: 역치 = ISO 값 + 상수(헤드폰 볼륨이 어떻든 모양이 같음) */
const normal = FREQS.map((f) => ISO226_TF[f] - 60)

describe('relativeLoss', () => {
  it('정상 귀 → 모두 0', () => {
    for (const v of relativeLoss(FREQS, normal)) expect(v).toBeCloseTo(0, 6)
  })
  it('4kHz만 15dB 덜 들림 → 4kHz 15', () => {
    const t = normal.map((v, i) => (FREQS[i] === 4000 ? v + 15 : v))
    expect(relativeLoss(FREQS, t)[5]).toBeCloseTo(15, 6)
  })
  it('못 잰 주파수는 null', () => {
    const t: (number | null)[] = [...normal]
    t[0] = null
    expect(relativeLoss(FREQS, t)[0]).toBeNull()
  })
})

describe('boosts: 5dB 빼고 × 세기, 0~6', () => {
  const none = FREQS.map(() => false)
  it('정상 귀 → 모두 0', () => {
    expect(boosts(relativeLoss(FREQS, normal), null, 0.5, none).every((b) => b === 0)).toBe(true)
  })
  it('15dB 덜 들림, 세기 50% → 5dB', () => {
    expect(boosts([15], null, 0.5, [false])[0]).toBeCloseTo(5, 6)
  })
  it('30dB 덜 들림 → 6dB에서 자름', () => {
    expect(boosts([30], null, 1, [false])[0]).toBe(6)
  })
  it('더 잘 들림·5dB 안쪽·못 잼(null) → 0', () => {
    expect(boosts([-10, 4, null], null, 1, [false, false, false])).toEqual([0, 0, 0])
  })
  it('최대 크기에서도 안 들림 → 6dB 상한', () => {
    expect(boosts([40], null, 0.5, [true])[0]).toBe(6)
  })
  it('기기 몫: 기기가 그 주파수에서 3dB 더 크게 나면 덜 들림에 3을 더함', () => {
    expect(boosts([15], [3], 0.5, [false])[0]).toBe(6)
    expect(boosts([10], [3], 0.5, [false])[0]).toBeCloseTo(4, 6)
  })
})

describe('layerCurve', () => {
  const b = [1, 1, 0, 0, 2, 4, 3]
  const out = [20, 125, 2000, 2828, 4000, 8000, 10000, 12000, 16000]
  const y = layerCurve(FREQS, b, out)
  it('125Hz 아래는 125Hz 값', () => {
    expect(y[0]).toBe(1)
    expect(y[1]).toBe(1)
  })
  it('사이는 로그 주파수로 이음', () => {
    expect(y[2]).toBeCloseTo(2, 6)
    expect(y[3]).toBeCloseTo(3, 2)
    expect(y[4]).toBeCloseTo(4, 6)
  })
  it('8kHz 위는 줄어 12kHz부터 0', () => {
    expect(y[5]).toBeCloseTo(3, 6)
    expect(y[6]).toBeGreaterThan(0)
    expect(y[6]).toBeLessThan(3)
    expect(y[7]).toBeCloseTo(0, 6)
    expect(y[8]).toBe(0)
  })
})

describe('deviceOffset', () => {
  const grid = [100, 500, 1000, 2000, 4000, 8000]
  it('기기 = 타깃이면 0', () => {
    const v = [1, 2, 3, 4, 5, 6]
    expect(deviceOffset(v, v, grid, [500, 4000])).toEqual([0, 0])
  })
  it('500·1k·2k 평균 기준, 5kHz 위는 절반', () => {
    const target = [0, 0, 0, 0, 0, 0]
    const device = [0, 1, 1, 1, 4, 5]
    const o = deviceOffset(device, target, grid, [1000, 4000, 8000])
    expect(o[0]).toBeCloseTo(0, 6)
    expect(o[1]).toBeCloseTo(3, 6)
    expect(o[2]).toBeCloseTo(2, 6)
  })
})
