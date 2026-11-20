// 폰 화면에서 아래쪽 기기 목록의 높이(px) 계산. 순수 함수.
// 손잡이를 끌면 clampListHeight, 끌지 않고 누르면 tapTarget을 쓴다.

/** 가장 낮게 내렸을 때의 기본값(실제로는 위쪽 부품 높이를 재서 더 클 수 있음) */
export const LIST_MIN_PX = 150
/** 가장 높게 올렸을 때: 화면 높이의 이 비율(위에 메뉴 줄과 탭이 조금 남게) */
const MAX_RATIO = 0.88
/** 누르면 펼칠 높이(화면 비율) */
const EXPANDED_RATIO = 0.8
/** 이보다 높으면 "펼친 상태"로 보고, 누르면 기본 높이로 돌린다 */
const TALL_RATIO = 0.6

/**
 * minPx: 목록 위쪽 부품(손잡이·헤드폰/이어폰·검색창)의 실제 높이. 화면마다(터치용으로 커진 버튼 등) 달라서
 * 화면에서 재서 넘긴다. LIST_MIN_PX보다 낮게는 내려가지 않는다
 */
export function clampListHeight(px: number, viewportHeight: number, minPx = LIST_MIN_PX): number {
  const min = Math.max(LIST_MIN_PX, minPx)
  return Math.round(Math.min(viewportHeight * MAX_RATIO, Math.max(min, px)))
}

/** 누른 뒤의 높이(px). null이면 CSS 기본 높이(화면의 45%, 낮은 폰은 38%)로 돌린다 */
export function tapTarget(currentPx: number, viewportHeight: number): number | null {
  return currentPx < viewportHeight * TALL_RATIO ? Math.round(viewportHeight * EXPANDED_RATIO) : null
}
