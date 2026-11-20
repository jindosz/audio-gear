// eqDevice.ts 테스트(PEQ → 안드로이드 127밴드). 실행: npm test
import { describe, expect, it } from 'vitest'
import { DEVICE_EQ_FREQS, toDeviceEq } from './eqDevice'

const nearest = (hz: number) =>
  DEVICE_EQ_FREQS.reduce((best, f, i) => (Math.abs(Math.log(f / hz)) < Math.abs(Math.log(DEVICE_EQ_FREQS[best] / hz)) ? i : best), 0)

describe('toDeviceEq', () => {
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

  it('입력 게인은 올리지 않는다(최대 0dB)', () => {
    expect(toDeviceEq({ filters: [], preamp: 2 }).inputGain).toBe(0)
  })
})
