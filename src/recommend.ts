// 추천 목록 만들기. 계산(similarity.ts)을 써서 후보를 "출처가 맞는 정도 → 거리" 순으로 줄 세운다.
// 화면·DB와 상관없는 순수 함수.
//
// 왜 출처를 먼저 보나: 같은 기기라도 측정자·리그가 다르면 곡선이 꽤 달라서(HD 600 기준 2dB 이상),
// 출처가 다른 후보끼리 거리를 그대로 비교하면 "소리 차이"보다 "측정 환경 차이"를 재게 된다.
import { distance, explain, prepare, SUMMARY_GRID, type Values } from './similarity'
import type { Device, DeviceCategory, FrCurve, Measurement, Rig } from './types'

/** 기준: 선택한 측정치 또는 타깃 */
export interface Reference {
  curve: FrCurve
  category: DeviceCategory
  rig: Rig
  /** 측정자(측정치의 source). 타깃이면 없음 */
  source?: string
  /** 기준 기기 자신은 후보에서 뺀다 */
  deviceId?: string
}

/** 출처가 기준과 맞는 정도. 숫자가 작을수록 믿을 만한 비교 */
export type MatchLevel = 0 | 1 | 2
export const matchLabels: Record<MatchLevel, string> = {
  0: '같은 측정자',
  1: '같은 리그',
  2: '다른 출처 (참고용)',
}

export interface Recommendation {
  device: Device
  measurement: Measurement
  level: MatchLevel
  /** 기준과의 거리(dB). 작을수록 비슷 */
  distance: number
  /** 기준보다 많거나 적은 대역. 예: ["고음(5~10kHz) +2.9dB"] */
  reasons: string[]
}

function matchLevel(ref: Reference, m: Measurement): MatchLevel {
  if (ref.source && ref.source !== 'local' && m.source === ref.source) return 0
  // 리그를 모르는 경우('other')는 같다고 보지 않는다
  if (ref.rig !== 'other' && m.rig === ref.rig) return 1
  return 2
}

/** 거리를 말로. 기준은 써 보면서 조정한다 */
export function similarityLabel(d: number): string {
  if (d < 1) return '매우 비슷'
  if (d < 2) return '비슷'
  if (d < 3) return '조금 다름'
  return '많이 다름'
}

/**
 * 후보 측정치들로 추천 목록을 만든다.
 * - 기준과 같은 카테고리(헤드폰/이어폰)만, 기준 기기 자신은 제외
 * - 한 기기에 측정치가 여러 개면 출처가 가장 잘 맞는 것(같으면 더 가까운 것) 하나만
 * - 정렬: 출처 맞음 정도 → 거리
 */
export function recommend(
  ref: Reference,
  candidates: { device: Device; measurement: Measurement }[],
  limit = 30,
): Recommendation[] {
  const refValues = prepare(ref.curve, SUMMARY_GRID)
  const best = new Map<string, Recommendation>()

  for (const { device, measurement } of candidates) {
    if (device.category !== ref.category || device.id === ref.deviceId) continue
    const values: Values = prepare(measurement.curve, SUMMARY_GRID)
    const d = distance(values, refValues, SUMMARY_GRID)
    if (d === null) continue
    const rec: Recommendation = {
      device,
      measurement,
      level: matchLevel(ref, measurement),
      distance: d,
      reasons: explain(values, refValues, SUMMARY_GRID),
    }
    const prev = best.get(device.id)
    if (!prev || rec.level < prev.level || (rec.level === prev.level && rec.distance < prev.distance)) {
      best.set(device.id, rec)
    }
  }

  return [...best.values()].sort((a, b) => a.level - b.level || a.distance - b.distance).slice(0, limit)
}
