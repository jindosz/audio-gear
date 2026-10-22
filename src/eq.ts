// EQ 계산기: "지금 쓰는 기기"에 걸면 "들어볼 기기"와 주파수 응답이 비슷해지는 EQ를 만든다.
// 화면·DB와 상관없는 순수 함수.
//
// 1) 목표 EQ = 들어볼 기기 곡선 − 지금 기기 곡선 (둘 다 1/3옥타브 스무딩, 300Hz~3kHz 평균 = 0dB)
//    좁은 피크·딥까지 따라가면 측정 편차를 EQ로 옮기게 되므로, 큰 음색(톤 밸런스)만 따라간다
// 2) 안전 장치: 부스트는 최대 +6dB, 8kHz 위는 측정 편차가 커서 점점 덜 따라가고 12kHz 위는 0
// 3) PEQ 맞추기: 피크 필터를 하나씩 놓아 목표 EQ를 따라가게 한다(남은 오차가 가장 큰 곳부터)
// 4) 프리앰프: EQ로 가장 많이 올라가는 만큼 전체 음량을 미리 낮춰 소리가 깨지지 않게 한다
import { FINE_GRID, prepare, type Values } from './similarity'
import type { FrCurve } from './types'

/** 피크 필터 하나(파라메트릭 EQ의 한 밴드) */
export interface PeakFilter {
  /** 중심 주파수(Hz) */
  freq: number
  /** 올리거나 내리는 양(dB) */
  gain: number
  /** 폭. 클수록 좁은 범위만 바뀐다 */
  q: number
}

export interface EqResult {
  /** 목표 EQ(FINE_GRID 위의 dB) */
  target: Values
  filters: PeakFilter[]
  /** 필터들을 모두 걸었을 때의 실제 EQ 곡선(FINE_GRID 위의 dB) */
  response: number[]
  /** 전체 음량 조절(dB, 0 이하) */
  preamp: number
  /** 목표와 실제의 차이(가중 RMS, dB). 작을수록 잘 따라감 */
  error: number
}

const SAMPLE_RATE = 48000
export const MAX_BOOST = 6
const MAX_CUT = -12

/**
 * 피크 필터의 주파수별 크기(dB). 대부분의 EQ 프로그램이 쓰는 "RBJ 오디오 EQ 쿡북" 공식이라
 * Equalizer APO 등에 같은 값을 넣으면 같은 모양이 된다.
 */
export function peakResponse(filter: PeakFilter, freqs: number[]): number[] {
  const A = 10 ** (filter.gain / 40)
  const w0 = (2 * Math.PI * filter.freq) / SAMPLE_RATE
  const alpha = Math.sin(w0) / (2 * filter.q)
  const cos = Math.cos(w0)
  const b0 = 1 + alpha * A
  const b1 = -2 * cos
  const b2 = 1 - alpha * A
  const a0 = 1 + alpha / A
  const a1 = -2 * cos
  const a2 = 1 - alpha / A
  return freqs.map((f) => {
    const w = (2 * Math.PI * f) / SAMPLE_RATE
    // 복소수 e^{-jw}, e^{-2jw}를 실수부·허수부로 나눠 계산
    const c1 = Math.cos(w)
    const s1 = Math.sin(w)
    const c2 = Math.cos(2 * w)
    const s2 = Math.sin(2 * w)
    const numRe = b0 + b1 * c1 + b2 * c2
    const numIm = -(b1 * s1 + b2 * s2)
    const denRe = a0 + a1 * c1 + a2 * c2
    const denIm = -(a1 * s1 + a2 * s2)
    return 10 * Math.log10((numRe ** 2 + numIm ** 2) / (denRe ** 2 + denIm ** 2))
  })
}

/** 주파수별 중요도. 8kHz 위로 갈수록 줄어 12kHz부터 0(측정 편차가 커서 따라가지 않음) */
function weight(f: number): number {
  if (f < 20) return 0
  if (f <= 8000) return 1
  if (f >= 12000) return 0
  return 1 - (f - 8000) / 4000
}

/** 목표 EQ 곡선 만들기: 들어볼 기기 − 지금 기기, 부스트 제한, 고음은 점점 0으로 */
export function targetEq(current: FrCurve, wish: FrCurve, grid: number[] = FINE_GRID): Values {
  const a = prepare(current, grid, 3)
  const b = prepare(wish, grid, 3)
  return grid.map((f, i) => {
    const x = a[i]
    const y = b[i]
    if (x === null || y === null) return null
    const diff = Math.max(MAX_CUT, Math.min(MAX_BOOST, y - x))
    return diff * weight(f)
  })
}

/** 가중 오차 제곱합(작을수록 목표에 가까움) */
function cost(target: Values, response: number[], grid: number[]): number {
  let sum = 0
  grid.forEach((f, i) => {
    const t = target[i]
    if (t !== null) sum += weight(f) * (t - response[i]) ** 2
  })
  return sum
}

function totalResponse(filters: PeakFilter[], grid: number[]): number[] {
  const total = grid.map(() => 0)
  for (const filter of filters) peakResponse(filter, grid).forEach((v, i) => (total[i] += v))
  return total
}

/**
 * 필터 하나를 조금씩 움직여(주파수·게인·Q) 오차가 줄어드는 쪽으로 다듬는다.
 * "좌표 하강"이라는 단순한 방법: 한 값씩 위아래로 바꿔 보고 나아지면 그 값을 쓰고, 안 나아지면 보폭을 줄인다
 */
function refine(filter: PeakFilter, others: number[], target: Values, grid: number[]): PeakFilter {
  let best = { ...filter }
  const evaluate = (f: PeakFilter) => {
    const r = peakResponse(f, grid)
    return cost(target, r.map((v, i) => v + others[i]), grid)
  }
  let bestCost = evaluate(best)
  let step = { freq: 2 ** (1 / 6), gain: 1, q: 1.3 }
  for (let round = 0; round < 40; round++) {
    let improved = false
    const tries: PeakFilter[] = [
      { ...best, freq: Math.min(12000, best.freq * step.freq) },
      { ...best, freq: Math.max(20, best.freq / step.freq) },
      { ...best, gain: Math.min(MAX_BOOST, best.gain + step.gain) },
      { ...best, gain: Math.max(MAX_CUT, best.gain - step.gain) },
      { ...best, q: Math.min(4, best.q * step.q) }, // Q 4 이하: 너무 좁은 필터는 쓰지 않는다
      { ...best, q: Math.max(0.4, best.q / step.q) },
    ]
    for (const t of tries) {
      const c = evaluate(t)
      if (c < bestCost - 1e-6) {
        best = t
        bestCost = c
        improved = true
      }
    }
    if (!improved) {
      step = { freq: step.freq ** 0.5, gain: step.gain / 2, q: step.q ** 0.5 }
      if (step.gain < 0.02) break
    }
  }
  return best
}

/** 목표 EQ를 피크 필터 maxFilters개 이하로 따라간다 */
export function fitPeq(target: Values, grid: number[] = FINE_GRID, maxFilters = 10): EqResult {
  let filters: PeakFilter[] = []

  for (let n = 0; n < maxFilters; n++) {
    const current = totalResponse(filters, grid)
    // 남은 오차가 가장 큰 곳(가중치 반영)에 새 필터를 놓는다
    let worst = -1
    let worstValue = 0
    grid.forEach((f, i) => {
      const t = target[i]
      if (t === null) return
      const r = (t - current[i]) * weight(f)
      if (Math.abs(r) > Math.abs(worstValue)) {
        worstValue = r
        worst = i
      }
    })
    if (worst < 0 || Math.abs(worstValue) < 0.3) break // 0.3dB보다 작은 오차는 들리지 않는다
    const added = refine({ freq: grid[worst], gain: worstValue, q: 1.4 }, current, target, grid)
    filters.push(added)

    // 새 필터가 들어오면 기존 필터들도 한 번씩 다시 다듬는다
    filters = filters.map((f, i) => {
      const others = totalResponse(filters.filter((_, j) => j !== i), grid)
      return refine(f, others, target, grid)
    })
  }

  // 효과가 거의 없는 필터는 빼고, EQ 프로그램에 적기 좋게 반올림한 값으로 결과를 다시 계산한다
  filters = filters
    .filter((f) => Math.abs(f.gain) >= 0.2)
    .sort((a, b) => a.freq - b.freq)
    .map((f) => ({ freq: Math.round(f.freq), gain: Math.round(f.gain * 10) / 10, q: Math.round(f.q * 100) / 100 }))
  const response = totalResponse(filters, grid)
  const weightSum = grid.reduce((s, f, i) => (target[i] === null ? s : s + weight(f)), 0)
  const error = Math.sqrt(cost(target, response, grid) / weightSum)
  // 가장 많이 올라가는 곳만큼 미리 낮춘다(소수 첫째 자리에서 올림해 여유를 둠)
  const peak = Math.max(0, ...response.filter((_, i) => grid[i] >= 20 && grid[i] <= 20000))
  const preamp = -Math.ceil(peak * 10) / 10

  return {
    target,
    filters,
    response,
    preamp,
    error,
  }
}
