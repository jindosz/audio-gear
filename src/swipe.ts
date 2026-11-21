// 비교 탭 옆으로 밀어 넘기기의 판단(순수 함수). 붙이는 일은 useSwipeTabs.ts.
// 그래프 위에서 천천히 끌면 값 표시(툴팁)가 따라와야 해서, "빠르게 툭 민 것"만 탭 넘기기로 본다

/** 이만큼은 옆으로 움직여야(px) */
export const SWIPE_MIN_PX = 60
/** 이보다 빨라야(px/ms, 목록 시트 손잡이와 같은 기준) */
export const SWIPE_MIN_SPEED = 0.4

/**
 * dx·dy: 누른 곳에서 뗀 곳까지(px), ms: 걸린 시간.
 * 1 = 다음 탭(왼쪽으로 밀기), −1 = 이전 탭(오른쪽으로), 0 = 아님
 */
export function swipeStep(dx: number, dy: number, ms: number): -1 | 0 | 1 {
  const ax = Math.abs(dx)
  if (ax < SWIPE_MIN_PX || ax < Math.abs(dy) * 2) return 0
  if (ms <= 0 || ax / ms < SWIPE_MIN_SPEED) return 0
  return dx < 0 ? 1 : -1
}

/** 옆 탭 id. 끝이면 넘어가지 않고 null */
export function neighborTab(ids: string[], activeId: string | undefined, step: -1 | 1): string | null {
  const i = activeId ? ids.indexOf(activeId) : -1
  if (i < 0) return null
  return ids[i + step] ?? null
}
