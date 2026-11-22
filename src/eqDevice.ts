// 이 앱의 EQ(피크 필터 + 프리앰프)를 안드로이드 기본 효과 DynamicsProcessing이 받는 형식으로 바꾼다. 순수 함수.
// DynamicsProcessing의 EQ는 피크 필터가 아니라 "밴드 위쪽 끝 주파수 + 그 밴드의 게인"을 늘어놓는 방식이라,
// 필터를 모두 건 결과(합 응답)를 127개 주파수에서 계산해 밴드마다 그 값을 준다.
// 계산은 여기 한 곳에서 하고, 안드로이드 쪽(SystemEqService.java)은 받은 값만 건다.
import { totalResponse } from './eq'
import { GRAPHIC_EQ_FREQS, type EqSettings } from './eqExport'
import { FINE_GRID } from './similarity'

/** 밴드 중심 주파수 127개. Wavelet과 같은 목록(폴드7에서 127밴드 시험 완료) */
export const DEVICE_EQ_FREQS = GRAPHIC_EQ_FREQS

/** 안전 장치: 밴드 게인 범위(dB) */
const MAX_GAIN = 6
const MIN_GAIN = -24

export interface DeviceEq {
  /** 밴드마다 위쪽 끝 주파수(Hz). 오름차순, 마지막은 20000 */
  cutoffs: number[]
  /** 밴드 게인(dB) */
  gains: number[]
  /** 전체 입력 음량(dB, 0 이하) = 프리앰프 */
  inputGain: number
}

/** 밴드 i의 위쪽 끝 = i번째와 i+1번째 주파수의 기하 평균(로그 축에서 한가운데), 마지막 밴드는 20000Hz */
const CUTOFFS = DEVICE_EQ_FREQS.map((f, i) => (i === DEVICE_EQ_FREQS.length - 1 ? 20000 : Math.sqrt(f * DEVICE_EQ_FREQS[i + 1])))

/**
 * layer: 내 귀 보정(earEq.ts, 귀마다 127개 dB). 있으면 왼쪽(gains)·오른쪽(gainsRight)을 따로 만든다.
 * EQ 몫(+6 상한)과 보정 몫(+6 상한)을 더해 +12까지 허용하고, 입력 게인은 가장 큰 부스트만큼 낮춰 소리가 깨지지 않게 한다
 */
export function toDeviceEq(eq: PhoneEqSettings, layer?: EarLayerLike | null): DeviceEq & { gainsRight?: number[] } {
  const raw = eq.curve ? sampleCurve(eq.curve) : totalResponse(eq.filters, [...DEVICE_EQ_FREQS])
  const response = raw.map((v) => Math.min(MAX_GAIN, Math.max(MIN_GAIN, v)))
  // 곡선 그대로면 프리앰프를 곡선의 가장 큰 부스트로(필터의 프리앰프는 필터 모양 기준이라)
  const preamp = eq.curve ? -Math.max(0, ...response) : eq.preamp
  if (!layer) return { cutoffs: [...CUTOFFS], gains: response, inputGain: Math.min(0, preamp) }
  const add = (extra: number[]) => response.map((v, i) => Math.min(MAX_GAIN * 2, v + (extra[i] ?? 0)))
  const gains = add(layer.left)
  const gainsRight = add(layer.right)
  const peak = Math.max(0, ...gains, ...gainsRight)
  return { cutoffs: [...CUTOFFS], gains, gainsRight, inputGain: Math.min(0, preamp, -peak) }
}

/**
 * 폰에 거는 EQ: 보통은 필터(filters·preamp), "곡선 그대로"면 curve(FINE_GRID 위 dB)를 쓴다.
 * 폰 EQ는 127밴드라 필터로 바꾸지 않고 목표 곡선을 그대로 걸 수 있다(필터 10개로 생기는 오차가 없음)
 */
export type PhoneEqSettings = EqSettings & { curve?: number[] }

/** FINE_GRID 위 곡선을 127개 주파수로(로그 주파수 직선 보간, 범위 밖은 끝 값) */
function sampleCurve(curve: number[]): number[] {
  return DEVICE_EQ_FREQS.map((f) => {
    if (f <= FINE_GRID[0]) return curve[0] ?? 0
    const last = FINE_GRID.length - 1
    if (f >= FINE_GRID[last]) return curve[last] ?? 0
    let i = 0
    while (FINE_GRID[i + 1] < f) i++
    const t = Math.log(f / FINE_GRID[i]) / Math.log(FINE_GRID[i + 1] / FINE_GRID[i])
    return (curve[i] ?? 0) + ((curve[i + 1] ?? 0) - (curve[i] ?? 0)) * t
  })
}

/** earEq.ts의 EarLayer와 같은 모양(서로 import하지 않게 여기 따로 적음) */
interface EarLayerLike {
  left: number[]
  right: number[]
}
