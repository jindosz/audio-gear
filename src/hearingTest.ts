// 내 귀 보정: 겨우 들리는 크기(역치) 재기. 순수 함수.
// 수정 Hughson-Westlake 계단법(병원 청력검사와 같은 방식):
// 들리면 10dB 줄이고, 안 들리면 5dB 키운다. 안 들리다가 키워서(올라가는 단계) 같은 크기를 두 번 들으면 그 크기가 역치.
// 크기는 dBFS(디지털 크기). 실제 음압은 모르므로 상대값으로만 쓴다(earEq.ts).

/** 재는 순서(1kHz부터, 끝에 1kHz를 한 번 더 재서 흔들림 확인) */
export const HEARING_FREQS = [1000, 2000, 4000, 8000, 500, 250, 125] as const
export const RECHECK_FREQ = 1000

export const START_DB = -40
/** 안전: 이보다 크게는 절대 내지 않는다 */
export const MAX_DB = -10
export const MIN_DB = -100
const DOWN_DB = 10
const UP_DB = 5
/** 한 주파수에 최대 이만큼만 들려준다 */
const MAX_TRIALS = 20
/** 올라가는 단계에서 같은 크기를 이만큼 들으면 역치 */
const HITS_NEEDED = 2
/** 최대 크기에서 이만큼 안 들리면 "못 잼" */
const LIMIT_MISSES = 2
/** 가짜 문항(소리 없음) 비율 */
const CATCH_RATE = 0.15

export interface Trial {
  level: number
  heard: boolean
  /** 안 들려서 키운 다음의 문항(올라가는 단계) */
  ascending: boolean
}

export interface Staircase {
  /** 다음에 들려줄 크기 */
  level: number
  trials: Trial[]
  /** 정해진 역치(아직이면 null) */
  threshold: number | null
  /** 최대 크기에서도 안 들려서 제대로 못 잼 */
  atLimit: boolean
}

export function newStaircase(): Staircase {
  return { level: START_DB, trials: [], threshold: null, atLimit: false }
}

/** 응답 하나를 넣고 다음 상태를 돌려준다(원래 객체는 그대로). 이미 끝났으면 그대로 */
export function respond(s: Staircase, heard: boolean): Staircase {
  if (s.threshold !== null) return s
  const prev = s.trials[s.trials.length - 1]
  const ascending = !!prev && !prev.heard
  const trials = [...s.trials, { level: s.level, heard, ascending }]

  if (heard && ascending) {
    const hits = trials.filter((t) => t.level === s.level && t.ascending && t.heard).length
    if (hits >= HITS_NEEDED) return { level: s.level, trials, threshold: s.level, atLimit: false }
  }
  if (!heard && s.level >= MAX_DB) {
    const misses = trials.filter((t) => t.level >= MAX_DB && !t.heard).length
    if (misses >= LIMIT_MISSES) return { level: s.level, trials, threshold: MAX_DB, atLimit: true }
  }
  if (trials.length >= MAX_TRIALS) return finish(trials)

  const level = heard ? Math.max(MIN_DB, s.level - DOWN_DB) : Math.min(MAX_DB, s.level + UP_DB)
  return { level, trials, threshold: null, atLimit: false }
}

/** 횟수를 다 썼을 때: 올라가는 단계에서 들은 크기들의 평균(없으면 들은 크기 평균, 그것도 없으면 못 잼) */
function finish(trials: Trial[]): Staircase {
  const last = trials[trials.length - 1]
  const asc = trials.filter((t) => t.ascending && t.heard).map((t) => t.level)
  const any = trials.filter((t) => t.heard).map((t) => t.level)
  const pick = asc.length ? asc : any
  if (!pick.length) return { level: last.level, trials, threshold: MAX_DB, atLimit: true }
  const mean = pick.reduce((a, b) => a + b, 0) / pick.length
  return { level: last.level, trials, threshold: Math.round(mean), atLimit: false }
}

/** 이번 문항을 소리 없는 가짜로 할지 */
export function isCatchTrial(rand: () => number): boolean {
  return rand() < CATCH_RATE
}

/** 다음 소리까지 쉬는 시간(ms): 1~2.5초 무작위(박자에 맞춰 누르지 않게) */
export function gapMs(rand: () => number): number {
  return Math.round(1000 + rand() * 1500)
}

/** 한 귀의 결과 */
export interface EarResult {
  /** 주파수(오름차순) */
  freqs: number[]
  /** 역치(dBFS). 못 정했으면 null */
  thresholds: (number | null)[]
  /** 최대 크기에서도 안 들림 */
  atLimit: boolean[]
  /** 끝에 다시 잰 1kHz 역치 */
  recheck: number | null
  /** 가짜 문항(소리 없음)에서 누른 횟수 */
  falseAlarms: number
}

/** 결과 경고: 가짜 문항에서 3번 넘게 누름, 1kHz 처음·마지막 값이 10dB 넘게 다름 */
export function earWarnings(r: EarResult, firstAt1k: number | null): { falseAlarms: boolean; unstable: boolean } {
  const unstable = firstAt1k !== null && r.recheck !== null && Math.abs(firstAt1k - r.recheck) > 10
  return { falseAlarms: r.falseAlarms > 3, unstable }
}
