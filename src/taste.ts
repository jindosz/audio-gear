// 취향 곡선 만들기: 여러 기기의 평균 + "저음 조금 더" 같은 조절. 화면·DB와 상관없는 순수 함수.
// 결과는 similarity.ts의 prepare를 거친 값과 같은 형식(같은 grid, 300Hz~3kHz 평균 = 0dB)이라
// 그대로 추천 기준으로 쓸 수 있다.
import { normalizeBand, type Values } from './similarity'
import type { FrCurve } from './types'

/** 칸마다 평균. 어떤 곡선에 값이 없는 칸은 값이 있는 곡선들로만 평균, 모두 없으면 null */
export function averageValues(list: Values[]): Values {
  if (list.length === 0) return []
  return list[0].map((_, i) => {
    const present = list.map((v) => v[i]).filter((v): v is number => v !== null && v !== undefined)
    return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null
  })
}

/** 조절값(dB). 0이면 그대로 */
export interface Adjustments {
  /** 저음: 약 150Hz 아래를 올리고 내린다(로우 셸프) */
  bass: number
  /** 중고음: 3kHz 근처(약 1옥타브 폭)를 올리고 내린다. 소리의 선명함·쏘는 느낌에 영향 */
  presence: number
  /** 고음: 약 6kHz 위를 올리고 내린다(하이 셸프). 밝기·치찰음에 영향 */
  treble: number
}

export const NO_ADJUSTMENTS: Adjustments = { bass: 0, presence: 0, treble: 0 }

// 각 조절이 주파수마다 얼마나 적용되는지(0~1). EQ의 셸프·피크 필터와 비슷한 부드러운 모양
const lowShelf = (f: number) => 1 / (1 + (f / 150) ** 2)
const highShelf = (f: number) => 1 / (1 + (6000 / f) ** 2)
const bell = (f: number) => Math.exp(-((Math.log2(f / 3000) / 0.6) ** 2))

/** 조절값을 더한 뒤 다시 300Hz~3kHz 평균을 0dB로 맞춘다(후보 곡선들과 같은 기준으로 비교하려고) */
export function applyAdjustments(values: Values, grid: number[], adj: Adjustments): Values {
  const adjusted = values.map((v, i) => {
    if (v === null) return null
    const f = grid[i]
    return v + adj.bass * lowShelf(f) + adj.presence * bell(f) + adj.treble * highShelf(f)
  })
  return normalizeBand(adjusted, grid)
}

/** 값 배열을 곡선으로(타깃으로 저장할 때) */
export function toCurve(values: Values, grid: number[]): FrCurve {
  const curve: FrCurve = []
  grid.forEach((freq, i) => {
    const db = values[i]
    if (db !== null) curve.push({ freq, db: Math.round(db * 100) / 100 })
  })
  return curve
}
