// 이 앱의 EQ(피크 필터 + 프리앰프)를 안드로이드 기본 효과 DynamicsProcessing이 받는 형식으로 바꾼다. 순수 함수.
// DynamicsProcessing의 EQ는 피크 필터가 아니라 "밴드 위쪽 끝 주파수 + 그 밴드의 게인"을 늘어놓는 방식이라,
// 필터를 모두 건 결과(합 응답)를 127개 주파수에서 계산해 밴드마다 그 값을 준다.
// 계산은 여기 한 곳에서 하고, 안드로이드 쪽(SystemEqService.java)은 받은 값만 건다.
import { totalResponse } from './eq'
import { GRAPHIC_EQ_FREQS, type EqSettings } from './eqExport'

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

export function toDeviceEq(eq: EqSettings): DeviceEq {
  const response = totalResponse(eq.filters, [...DEVICE_EQ_FREQS])
  return {
    cutoffs: [...CUTOFFS],
    gains: response.map((v) => Math.min(MAX_GAIN, Math.max(MIN_GAIN, v))),
    inputGain: Math.min(0, eq.preamp),
  }
}
