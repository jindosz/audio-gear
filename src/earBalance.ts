// 내 귀 균형(좌·우 음량 맞추기) 계산. 순수 함수.
// 시험: 순음을 양쪽에 틀고 슬라이더로 "머리 한가운데서 들리게" 맞추기를 6번(BALANCE_FREQS 순서).
// 값의 뜻: "오른쪽을 왼쪽보다 몇 dB 크게 해야 가운데로 들리나"(양수 = 오른쪽이 덜 들림).
// 소리는 키우지 않고 큰 쪽을 줄이기만 한다(양수면 왼쪽을 낮춤). 네이티브(SystemEqService.java)도 같은 규칙.

/** 맞추는 순서: 두 바퀴. 같은 주파수의 두 값으로 흔들림을 본다 */
export const BALANCE_FREQS = [1000, 500, 4000, 1000, 500, 4000] as const
export const BALANCE_MIN = -12
export const BALANCE_MAX = 12
export const BALANCE_STEP = 0.5
/** 같은 주파수 두 값 차이가 이보다 크면 "들쭉날쭉" */
const UNSTABLE_DB = 3
/** 결과가 이만큼 이상이면 진료 권유 */
const DOCTOR_DB = 10

/** -0을 0으로(화면에 "-0"이 나오지 않게) */
const clean = (v: number) => (v === 0 ? 0 : v)

/** 0.5dB 단위로 반올림하고 슬라이더 범위로 자른다 */
export function roundStep(db: number): number {
  const v = Math.round(db / BALANCE_STEP) * BALANCE_STEP
  return clean(Math.min(BALANCE_MAX, Math.max(BALANCE_MIN, v)))
}

/**
 * 슬라이더 시작 위치: ±3~6dB(0.5 단위) 무작위. 가운데(0)에 그냥 두는 버릇을 막는다.
 * rand: 0 이상 1 미만(Math.random). 앞 절반이면 왼쪽(−), 뒤 절반이면 오른쪽(+)
 */
export function randomStart(rand: () => number): number {
  const r = rand()
  const sign = r < 0.5 ? -1 : 1
  const within = (r % 0.5) / 0.5 // 0~1
  return roundStep(sign * (3 + within * 3))
}

export interface BalanceResult {
  /** 결과(0.5dB 단위) */
  db: number
  /** 같은 주파수에서 두 번 맞춘 값이 3dB 넘게 다름 → 다시 재 보기 권유 */
  unstable: boolean
  /** 차이가 10dB 이상 → 진료 권유 */
  seeDoctor: boolean
}

/** answers: BALANCE_FREQS 순서로 맞춘 값 6개 */
export function summarize(answers: number[]): BalanceResult {
  const db = roundStep(answers.reduce((a, b) => a + b, 0) / answers.length)
  const half = BALANCE_FREQS.length / 2
  let unstable = false
  for (let i = 0; i < half; i++) {
    if (Math.abs(answers[i] - answers[i + half]) > UNSTABLE_DB) unstable = true
  }
  return { db, unstable, seeDoctor: Math.abs(db) >= DOCTOR_DB }
}

/** 각 채널에 더할 음량(dB, 0 이하). 큰 쪽만 줄인다 */
export function channelAttenuation(db: number): { left: number; right: number } {
  return { left: clean(-Math.max(0, db)), right: clean(-Math.max(0, -db)) }
}

/** 화면 문구: "가운데" / "왼쪽 1.5dB 낮춤" / "오른쪽 1.5dB 낮춤" */
export function balanceLabel(db: number): string {
  if (db === 0) return '가운데'
  return `${db > 0 ? '왼쪽' : '오른쪽'} ${Math.abs(db)}dB 낮춤`
}
