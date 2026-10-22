// FR 곡선 계산 함수 모음. 화면·DB와 상관없는 순수 함수.
import type { FrCurve } from './types'

/**
 * 20Hz~20kHz를 로그 간격으로 나눈 주파수 목록.
 * 측정치마다 주파수 위치가 달라서, 모든 곡선을 같은 주파수 위치로 맞춰(리샘플) 비교한다.
 * pointsPerOctave=24면 한 옥타브(주파수 2배)를 24칸으로 나눈다 → 약 240개
 */
export function logGrid(min = 20, max = 20000, pointsPerOctave = 24): number[] {
  const octaves = Math.log2(max / min)
  const count = Math.ceil(octaves * pointsPerOctave)
  // 마지막 칸은 max를 넘지 않게 자른다(20kHz까지 정확히 포함)
  return Array.from({ length: count + 1 }, (_, i) => Math.min(max, min * 2 ** (i / pointsPerOctave)))
}

/**
 * 곡선에서 주파수 f의 dB 값을 구한다. 측정점 사이는 로그 주파수 기준으로 직선 보간한다.
 * 곡선 범위 밖이면 null (없는 값을 지어내지 않는다)
 */
export function dbAt(curve: FrCurve, f: number): number | null {
  if (curve.length === 0 || f < curve[0].freq || f > curve[curve.length - 1].freq) return null
  // 이진 탐색: f보다 크거나 같은 첫 측정점을 찾는다 (정렬된 배열이라 절반씩 좁혀 간다)
  let lo = 0
  let hi = curve.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (curve[mid].freq < f) lo = mid + 1
    else hi = mid
  }
  const b = curve[lo]
  if (b.freq === f || lo === 0) return b.db
  const a = curve[lo - 1]
  const t = Math.log(f / a.freq) / Math.log(b.freq / a.freq)
  return a.db + t * (b.db - a.db)
}

/** 곡선을 주어진 주파수 목록 위치의 값들로 바꾼다 */
export function resample(curve: FrCurve, grid: number[]): (number | null)[] {
  return grid.map((f) => dbAt(curve, f))
}

/**
 * 정규화: 기준 주파수(hz)에서의 값이 0dB가 되도록 곡선 전체를 위아래로 옮긴다.
 * 측정 장비·출처마다 절대 음량이 달라서, 기준점을 맞춰야 모양을 비교할 수 있다.
 */
export function normalizeAt(values: (number | null)[], curve: FrCurve, hz: number | null): (number | null)[] {
  if (hz === null) return values
  const ref = dbAt(curve, hz)
  if (ref === null) return values
  return values.map((v) => (v === null ? null : v - ref))
}
