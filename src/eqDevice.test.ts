// eqDevice.ts 테스트(PEQ → 안드로이드 127밴드). 실행: npm test
import { describe, expect, it } from 'vitest'
import { DEVICE_EQ_FREQS, toDeviceEq } from './eqDevice'

const nearest = (hz: number) =>
  DEVICE_EQ_FREQS.reduce((best, f, i) => (Math.abs(Math.log(f / hz)) < Math.abs(Math.log(DEVICE_EQ_FREQS[best] / hz)) ? i : best), 0)

describe('toDeviceEq', () => {
  it('평평한 EQ(필터 없음)는 게인이 모두 0, 입력 게인 0(내 귀 균형만 걸 때)', () => {
    const d = toDeviceEq({ filters: [], preamp: 0 })
    expect(d.gains.every((g) => g === 0)).toBe(true)
    expect(d.inputGain).toBe(0)
  })
  it('밴드 127개, 밴드 끝은 이웃 주파수의 기하 평균이고 마지막은 20000Hz', () => {
    const d = toDeviceEq({ filters: [], preamp: 0 })
    expect(d.cutoffs).toHaveLength(127)
    expect(d.gains).toHaveLength(127)
    expect(d.cutoffs[0]).toBeCloseTo(Math.sqrt(20 * 21), 5)
    expect(d.cutoffs[126]).toBe(20000)
    for (let i = 1; i < 127; i++) expect(d.cutoffs[i]).toBeGreaterThan(d.cutoffs[i - 1])
  })

  it('필터가 없으면 모든 밴드 0dB, 입력 게인은 프리앰프', () => {
    const d = toDeviceEq({ filters: [], preamp: -3 })
    expect(d.gains.every((g) => g === 0)).toBe(true)
    expect(d.inputGain).toBe(-3)
  })

  it('1kHz +4dB 필터: 1kHz 밴드는 약 +4, 20Hz 밴드는 약 0', () => {
    const d = toDeviceEq({ filters: [{ freq: 1000, gain: 4, q: 1 }], preamp: -4 })
    expect(Math.abs(d.gains[nearest(1000)] - 4)).toBeLessThan(0.2)
    expect(Math.abs(d.gains[0])).toBeLessThan(0.1)
  })

  it('밴드 게인은 +6dB / -24dB로 자른다', () => {
    expect(toDeviceEq({ filters: [{ freq: 1000, gain: 20, q: 1 }], preamp: 0 }).gains[nearest(1000)]).toBe(6)
    expect(toDeviceEq({ filters: [{ freq: 1000, gain: -40, q: 1 }], preamp: 0 }).gains[nearest(1000)]).toBe(-24)
  })

  it('내 귀 보정 층: 귀마다 따로 더하고, 입력 게인은 가장 큰 부스트만큼 낮춤', () => {
    const left = DEVICE_EQ_FREQS.map((f) => (f === DEVICE_EQ_FREQS[nearest(4000)] ? 3 : 0))
    const right = DEVICE_EQ_FREQS.map(() => 0)
    const d = toDeviceEq({ filters: [], preamp: 0 }, { left, right })
    expect(d.gains[nearest(4000)]).toBeCloseTo(3, 6)
    expect(d.gainsRight?.[nearest(4000)]).toBeCloseTo(0, 6)
    expect(d.inputGain).toBeCloseTo(-3, 6)
  })

  it('층이 없으면 오른쪽 따로 값이 없음(양쪽 같음)', () => {
    expect(toDeviceEq({ filters: [], preamp: 0 }).gainsRight).toBeUndefined()
    expect(toDeviceEq({ filters: [], preamp: 0 }, null).gainsRight).toBeUndefined()
  })

  it('EQ와 층을 합치면 +12dB까지 허용(각각 +6 상한)', () => {
    const six = DEVICE_EQ_FREQS.map(() => 6)
    const d = toDeviceEq({ filters: [{ freq: 1000, gain: 20, q: 1 }], preamp: -6 }, { left: six, right: six })
    expect(d.gains[nearest(1000)]).toBe(12)
    expect(d.inputGain).toBe(-12)
  })

  it('입력 게인은 올리지 않는다(최대 0dB)', () => {
    expect(toDeviceEq({ filters: [], preamp: 2 }).inputGain).toBe(0)
  })
})
