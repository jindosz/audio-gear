// 폰 화면에서 아래쪽 기기 목록의 높이(px) 계산. 순수 함수.
// 손잡이를 끌면 clampListHeight, 끌지 않고 누르면 tapTarget을 쓴다.

/** 가장 낮게 내렸을 때: 손잡이·[헤드폰 | 이어폰]·검색창까지 보이는 높이 */
export const LIST_MIN_PX = 150
/** 가장 높게 올렸을 때: 화면 높이의 이 비율(위에 메뉴 줄과 탭이 조금 남게) */
const MAX_RATIO = 0.88
/** 누르면 펼칠 높이(화면 비율) */
const EXPANDED_RATIO = 0.8
/** 이보다 높으면 "펼친 상태"로 보고, 누르면 기본 높이로 돌린다 */
const TALL_RATIO = 0.6

export function clampListHeight(px: number, viewportHeight: number): number {
  return Math.round(Math.min(viewportHeight * MAX_RATIO, Math.max(LIST_MIN_PX, px)))
}

/** 누른 뒤의 높이(px). null이면 CSS 기본 높이(화면의 45%, 낮은 폰은 38%)로 돌린다 */
export function tapTarget(currentPx: number, viewportHeight: number): number | null {
  return currentPx < viewportHeight * TALL_RATIO ? Math.round(viewportHeight * EXPANDED_RATIO) : null
}
