// 추천 계산기: 두 곡선이 "소리가 얼마나 다른가"를 숫자로 만든다. 화면·DB와 상관없는 순수 함수.
// 설계는 CLAUDE.md의 "추천 기능 설계" 참고.
//
// 계산 순서(prepare): 리샘플 → 1/6옥타브 스무딩 → 300Hz~3kHz 평균을 0dB로 → 필요한 해상도로 다시 뽑기
// 거리(distance): 대역별 가중치를 둔 RMS. 작을수록 비슷하다. 단위는 dB
import { logGrid, resample } from './curve'
import type { FrCurve } from './types'

export type Values = (number | null)[]

/** 정밀 비교용: 그래프와 같은 해상도(한 옥타브에 24칸, 약 240개) */
export const FINE_GRID = logGrid()
/** 요약값용: 한 옥타브에 6칸(약 60개). 후보 수천 개를 저장·비교할 때 쓴다 */
export const SUMMARY_GRID = logGrid(20, 20000, 6)

/**
 * 옥타브 스무딩: 각 칸을 "주변 1/fraction 옥타브 폭" 안의 값들의 평균으로 바꾼다.
 * 측정 곡선의 잔물결(측정 위치·개체 차이로 생기는 작은 요철)을 줄여 큰 모양만 남긴다.
 */
export function smooth(values: Values, grid: number[], fraction = 6): Values {
  const half = 1 / (2 * fraction) // 양쪽으로 1/12옥타브씩 → 전체 폭 1/6옥타브
  return grid.map((f, i) => {
    if (values[i] === null) return null
    let sum = 0
    let count = 0
    for (let j = 0; j < grid.length; j++) {
      const v = values[j]
      if (v !== null && Math.abs(Math.log2(grid[j] / f)) <= half) {
        sum += v
        count++
      }
    }
    return sum / count
  })
}

/** lo~hi 대역의 평균이 0dB가 되도록 곡선 전체를 위아래로 옮긴다 */
export function normalizeBand(values: Values, grid: number[], lo = 300, hi = 3000): Values {
  const inBand = values.filter((v, i): v is number => v !== null && grid[i] >= lo && grid[i] <= hi)
  if (inBand.length === 0) return values
  const mean = inBand.reduce((a, b) => a + b, 0) / inBand.length
  return values.map((v) => (v === null ? null : v - mean))
}

/**
 * 측정치(또는 타깃) 곡선을 비교할 수 있는 모양으로 바꾼다.
 * - grid: FINE_GRID(정밀) 또는 SUMMARY_GRID(요약)
 * - smoothing: 스무딩 폭(1/n옥타브의 n). 클수록 좁은 피크·딥까지 남는다. 요약은 6, 정밀 비교는 더 크게
 */
export function prepare(curve: FrCurve, grid: number[] = FINE_GRID, smoothing = 6): Values {
  const fine = normalizeBand(smooth(resample(curve, FINE_GRID), FINE_GRID, smoothing), FINE_GRID)
  if (grid === FINE_GRID) return fine
  // 스무딩한 고해상도 곡선에서 요약용 주파수 위치의 값만 뽑는다
  const smoothed: FrCurve = []
  FINE_GRID.forEach((freq, i) => {
    const db = fine[i]
    if (db !== null) smoothed.push({ freq, db })
  })
  return resample(smoothed, grid)
}

/**
 * 대역별 가중치(처음 정한 값, 써 보면서 조정한다).
 * - 귀가 민감하고 측정도 안정적인 중음(250Hz~5kHz)을 가장 크게
 * - 초저음은 착용 상태(밀착)에 따라 크게 달라져서 낮게
 * - 10kHz 위는 측정할 때마다 들쭉날쭉해서 빼기(0)
 */
export function bandWeight(freq: number): number {
  if (freq < 60) return 0.5
  if (freq < 250) return 0.8
  if (freq < 5000) return 1
  if (freq <= 10000) return 0.6
  return 0
}

/**
 * 두 곡선의 거리(dB): 칸마다 차이를 제곱해 가중 평균을 낸 뒤 제곱근(가중 RMS).
 * 예) 차이가 [+2, -1, +3]dB, 가중치가 모두 1이면 √((4+1+9)/3) ≈ 2.2dB
 * 두 곡선이 겹치는 구간이 가중치 기준으로 절반이 안 되면 비교할 수 없어서 null
 */
export function distance(a: Values, b: Values, grid: number[]): number | null {
  let sum = 0
  let weightSum = 0
  let possible = 0
  grid.forEach((f, i) => {
    const w = bandWeight(f)
    possible += w
    const x = a[i]
    const y = b[i]
    if (w === 0 || x === null || y === null) return
    sum += w * (x - y) ** 2
    weightSum += w
  })
  if (weightSum < possible / 2) return null
  return Math.sqrt(sum / weightSum)
}

// ---- 성향 지표 ----

export const BANDS = [
  { key: 'subBass', label: '초저음', lo: 20, hi: 60 },
  { key: 'bass', label: '저음', lo: 60, hi: 250 },
  { key: 'lowMid', label: '중저음', lo: 250, hi: 800 },
  { key: 'mid', label: '중음', lo: 800, hi: 2000 },
  { key: 'presence', label: '중고음(2~5kHz)', lo: 2000, hi: 5000 },
  { key: 'treble', label: '고음(5~10kHz)', lo: 5000, hi: 10000 },
] as const

export type BandKey = (typeof BANDS)[number]['key']

/** 대역별 평균 dB. prepare를 거친 값(300Hz~3kHz 평균 = 0dB)에 쓴다 */
export function features(values: Values, grid: number[]): Record<BandKey, number | null> {
  const result = {} as Record<BandKey, number | null>
  for (const band of BANDS) {
    const inBand = values.filter((v, i): v is number => v !== null && grid[i] >= band.lo && grid[i] < band.hi)
    result[band.key] = inBand.length ? inBand.reduce((a, b) => a + b, 0) / inBand.length : null
  }
  return result
}

/**
 * 추천 이유: 후보가 기준보다 어느 대역이 많고 적은지, 차이가 큰 순서로 최대 max개.
 * 1dB보다 작은 차이는 듣고 구분하기 어려워서 뺀다.
 */
export function explain(candidate: Values, reference: Values, grid: number[], max = 2): string[] {
  const c = features(candidate, grid)
  const r = features(reference, grid)
  return BANDS.map((band) => {
    const x = c[band.key]
    const y = r[band.key]
    return { band, diff: x === null || y === null ? 0 : x - y }
  })
    .filter((d) => Math.abs(d.diff) >= 1)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, max)
    .map(({ band, diff }) => `${band.label} ${diff > 0 ? '+' : ''}${diff.toFixed(1)}dB`)
}
