// 추천 목록 만들기. 계산(similarity.ts)을 써서 후보를 "출처가 맞는 정도 → 거리" 순으로 줄 세운다.
// 화면·DB와 상관없는 순수 함수.
//
// 왜 출처를 먼저 보나: 같은 기기라도 측정자·리그가 다르면 곡선이 꽤 달라서(HD 600 기준 2dB 이상),
// 출처가 다른 후보끼리 거리를 그대로 비교하면 "소리 차이"보다 "측정 환경 차이"를 재게 된다.
import type { CatalogEntry } from './catalog'
import { distance, explain, prepare, SUMMARY_GRID, type Values } from './similarity'
import type { CatalogSummary, Device, DeviceCategory, FrCurve, Measurement, Rig } from './types'

/** 기준: 선택한 측정치 또는 타깃 */
export interface Reference {
  curve: FrCurve
  category: DeviceCategory
  rig: Rig
  /** 측정자(측정치의 source, 예: "AutoEQ · oratory1990"). 타깃이면 없음 */
  source?: string
  /** 기준 기기 이름("브랜드 모델"). 같은 기기는 후보에서 뺀다 */
  name?: string
}

/**
 * 후보 하나. 두 종류가 있다.
 * - 내 DB의 측정치(measurement): 이미 저장돼 있어서 바로 비교에 넣을 수 있다
 * - AutoEQ 요약값(catalog): 비교에 넣을 때 측정치를 받아 저장한다
 */
export interface Candidate {
  name: string
  category: DeviceCategory
  source: string
  rig: Rig
  values: Values
  device?: Device
  measurement?: Measurement
  catalog?: CatalogEntry
}

/** 내 DB 측정치 → 후보 */
export function fromMeasurement(device: Device, measurement: Measurement): Candidate {
  return {
    name: `${device.brand} ${device.model}`,
    category: device.category,
    source: measurement.source,
    rig: measurement.rig,
    values: prepare(measurement.curve, SUMMARY_GRID),
    device,
    measurement,
  }
}

/** AutoEQ 요약값 → 후보. 측정치 source 형식("AutoEQ · 측정자")에 맞춰 출처를 비교할 수 있게 한다 */
export function fromSummary(s: CatalogSummary): Candidate {
  return {
    name: s.name,
    category: s.category,
    source: `AutoEQ · ${s.measurer}`,
    rig: s.rig,
    values: s.values,
    catalog: {
      name: s.name,
      source: s.measurer,
      rigName: '',
      rig: s.rig,
      category: s.category,
      path: s.path,
      hasCurve: true,
      recommended: true,
    },
  }
}

/** 출처가 기준과 맞는 정도. 숫자가 작을수록 믿을 만한 비교 */
export type MatchLevel = 0 | 1 | 2
export const matchLabels: Record<MatchLevel, string> = {
  0: '같은 측정자',
  1: '같은 리그',
  2: '다른 출처 (참고용)',
}

export interface Recommendation {
  candidate: Candidate
  level: MatchLevel
  /** 기준과의 거리(dB). 작을수록 비슷 */
  distance: number
  /** 기준보다 많거나 적은 대역. 예: ["고음(5~10kHz) +2.9dB"] */
  reasons: string[]
}

function matchLevel(ref: Reference, c: Candidate): MatchLevel {
  if (ref.source && ref.source !== 'local' && c.source === ref.source) return 0
  // 리그를 모르는 경우('other')는 같다고 보지 않는다
  if (ref.rig !== 'other' && c.rig === ref.rig) return 1
  return 2
}

/** 거리를 말로. 기준은 써 보면서 조정한다 */
export function similarityLabel(d: number): string {
  if (d < 1) return '매우 비슷'
  if (d < 2) return '비슷'
  if (d < 3) return '조금 다름'
  return '많이 다름'
}

/** a가 b보다 나은 후보인가: 출처가 더 잘 맞거나, 같으면 더 가깝거나, 그것도 같으면 내 DB에 있는 쪽 */
function better(a: Recommendation, b: Recommendation): boolean {
  if (a.level !== b.level) return a.level < b.level
  if (Math.abs(a.distance - b.distance) > 0.01) return a.distance < b.distance
  return !!a.candidate.measurement && !b.candidate.measurement
}

/**
 * 후보들로 추천 목록을 만든다.
 * - 기준과 같은 카테고리(헤드폰/이어폰)만, 기준 기기 자신은 제외
 * - 같은 기기(이름)가 여러 번 나오면(측정치 여러 개, DB와 AutoEQ 양쪽) 가장 나은 하나만
 * - 정렬: 출처 맞음 정도 → 거리. 묶음(출처 맞음 정도)마다 가까운 순으로 최대 perLevel개
 *   (후보가 수천 개면 "같은 측정자" 묶음만으로 목록이 차 버려서 묶음마다 따로 자른다)
 */
export function recommend(ref: Reference, candidates: Candidate[], perLevel = 15): Recommendation[] {
  const refValues = prepare(ref.curve, SUMMARY_GRID)
  const best = new Map<string, Recommendation>()

  for (const candidate of candidates) {
    if (candidate.category !== ref.category || candidate.name === ref.name) continue
    const d = distance(candidate.values, refValues, SUMMARY_GRID)
    if (d === null) continue
    const rec: Recommendation = {
      candidate,
      level: matchLevel(ref, candidate),
      distance: d,
      reasons: explain(candidate.values, refValues, SUMMARY_GRID),
    }
    const prev = best.get(candidate.name)
    if (!prev || better(rec, prev)) best.set(candidate.name, rec)
  }

  const sorted = [...best.values()].sort((a, b) => a.level - b.level || a.distance - b.distance)
  return ([0, 1, 2] as const).flatMap((level) => sorted.filter((r) => r.level === level).slice(0, perLevel))
}
