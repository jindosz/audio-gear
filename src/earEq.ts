// 내 귀 보정 계산: 잰 역치(hearingTest.ts) → 덜 들리는 만큼 → 올릴 양 → 127밴드 곡선. 순수 함수.
// 1) 귀마다 상대 역치(500·1k·2k 평균 기준). 실제 음압을 모르니 모양만 본다(좌·우 음량 차이는 내 귀 균형이 맡음)
// 2) 정상 귀의 상대 역치(ISO 226:2003)를 뺀다. 안 빼면 정상 귀도 저음이 원래 덜 들려서 저음을 크게 올리게 된다
// 3) 기기 몫(측정치가 타깃보다 큰 만큼)을 더한다: 기기가 그 주파수에서 크게 나면 그만큼 작은 소리에도 들려서 덜 들림이 숨어 있음
// 4) 측정 오차 5dB를 빼고 × 세기(기본 50%), 0~+6dB. 깎지는 않는다
import type { EarResult } from './hearingTest'
import type { Values } from './similarity'

/**
 * 정상 귀가 겨우 듣는 크기(dB SPL, 정면 자유 음장). ISO 226:2003 표 1의 Tf(값의 근원은 ISO 389-7).
 * 원문은 유료라, 같은 표를 옮겨 둔 공개 구현 3곳에서 값이 같음을 확인(2026-11-21):
 * Rsantct/audiotools iso226.py, jcarrano/rtfi scripts/iso226.py, porres/pd-psycho Classes/iso226.c
 */
export const ISO226_TF: Record<number, number> = {
  125: 22.1,
  250: 11.4,
  500: 4.4,
  1000: 2.4,
  2000: -1.3,
  4000: -5.4,
  8000: 12.6,
}

/** 상대값의 기준 주파수(이 셋의 평균을 0으로) */
const REF_FREQS = [500, 1000, 2000]
/** 이만큼까지는 측정 오차로 보고 무시 */
const DEAD_ZONE_DB = 5
const MAX_BOOST_DB = 6
/** 기기 몫에서 이보다 높은 주파수는 절반만(장비와 실제 귀 차이가 큼) */
const HALF_ABOVE_HZ = 5000
/** 8kHz 위는 줄여서 12kHz에서 0 */
const FADE_FROM_HZ = 8000
const FADE_TO_HZ = 12000

/** 결과 저장 형식(localStorage `ear.profile`, earEqStore.ts) */
export interface EarProfile {
  measuredAt: string
  /** 시험에 쓴 기기("모름"이면 null) */
  device: { label: string; measurementId?: string; source?: string } | null
  left: EarResult
  right: EarResult
  /** 기기 몫(dB, left.freqs 순서). 기기를 모르면 null */
  offset: number[] | null
  /** 보정 세기 0~1 */
  strength: number
  on: boolean
  /** 마지막으로 고친 시각(동기화용) */
  updatedAt?: number
}

/** 안드로이드에 걸 귀마다의 보정(eqDevice.ts의 127개 주파수 순서, dB) */
export interface EarLayer {
  left: number[]
  right: number[]
}

function refMean(freqs: number[], values: (number | null)[]): number | null {
  const picked = REF_FREQS.map((f) => values[freqs.indexOf(f)]).filter((v): v is number => v !== null && v !== undefined)
  return picked.length ? picked.reduce((a, b) => a + b, 0) / picked.length : null
}

/** 정상 귀보다 덜 들리는 만큼(dB, 양수 = 덜 들림). 못 잰 곳은 null */
export function relativeLoss(freqs: number[], thresholds: (number | null)[]): (number | null)[] {
  const mine = refMean(freqs, thresholds)
  const iso = freqs.map((f) => ISO226_TF[f] ?? null)
  const isoRef = refMean(freqs, iso)
  return thresholds.map((t, i) => {
    const n = iso[i]
    if (t === null || n === null || mine === null || isoRef === null) return null
    return t - mine - (n - isoRef)
  })
}

/** values에서 f에 가장 가까운 칸(로그 거리)의 값 */
function at(values: Values, grid: number[], f: number): number | null {
  let best = 0
  for (let i = 1; i < grid.length; i++) if (Math.abs(Math.log(grid[i] / f)) < Math.abs(Math.log(grid[best] / f))) best = i
  return values[best]
}

/**
 * 기기 몫: 기기 측정치가 타깃보다 큰 만큼(dB, freqs 순서). 둘 다 같은 grid로 1옥타브 스무딩한 값을 넣는다.
 * 500·1k·2k 평균을 0으로 맞추고, 5kHz 위는 절반만
 */
export function deviceOffset(device: Values, target: Values, grid: number[], freqs: number[]): number[] {
  const diff = (f: number) => {
    const d = at(device, grid, f)
    const t = at(target, grid, f)
    return d === null || t === null ? null : d - t
  }
  const ref = refMean(REF_FREQS, REF_FREQS.map(diff)) ?? 0
  return freqs.map((f) => {
    const d = diff(f)
    if (d === null) return 0
    const v = d - ref
    return f > HALF_ABOVE_HZ ? v / 2 : v
  })
}

/** 올릴 양(dB): (덜 들림 + 기기 몫 − 5) × 세기, 0~6. 못 잰 곳은 0, 최대 크기에서도 안 들린 곳도 6이 상한 */
export function boosts(loss: (number | null)[], offset: number[] | null, strength: number, atLimit: boolean[]): number[] {
  return loss.map((l, i) => {
    if (l === null) return 0
    const v = (l + (offset?.[i] ?? 0) - DEAD_ZONE_DB) * strength
    const capped = Math.min(MAX_BOOST_DB, Math.max(0, v))
    return atLimit[i] ? Math.min(capped, MAX_BOOST_DB) : capped
  })
}

/** 잰 주파수(오름차순)의 올릴 양을 out 주파수들로 잇는다(로그 주파수 직선). 처음 아래는 처음 값, 8k→12k는 줄여서 0 */
export function layerCurve(freqs: number[], values: number[], out: readonly number[]): number[] {
  const last = freqs.length - 1
  return out.map((f) => {
    if (f <= freqs[0]) return values[0]
    if (f >= freqs[last]) {
      const fadeStart = Math.max(freqs[last], FADE_FROM_HZ)
      const base = values[last]
      if (f <= fadeStart) return base
      const k = 1 - Math.log(f / fadeStart) / Math.log(FADE_TO_HZ / fadeStart)
      return Math.max(0, base * k)
    }
    let i = 0
    while (freqs[i + 1] < f) i++
    const t = Math.log(f / freqs[i]) / Math.log(freqs[i + 1] / freqs[i])
    return values[i] + (values[i + 1] - values[i]) * t
  })
}
