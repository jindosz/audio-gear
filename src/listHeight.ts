// 폰 화면 아래쪽 기기 목록(시트)의 높이(px) 계산. 순수 함수.
// 시트는 세 자리(접힘·중간·펼침) 중 하나에 멈춘다(snap: 놓으면 가까운 자리로 착 붙는 것).
// - 끄는 동안: clampListHeight로 범위 안에서 손가락을 따라감
// - 놓았을 때: releaseSnap(빨리 툭 밀었으면 그 방향 다음 자리, 아니면 가장 가까운 자리)
// - 끌지 않고 누름: tapSnap(접힘→중간, 중간→펼침, 펼침→중간)

/** 세 자리. collapsed: 손잡이만 보임, middle: 기본(화면의 45%, 낮은 폰 38%), top: 메뉴 줄 바로 아래까지(모르면 화면의 88%) */
export interface SheetSnaps {
  collapsed: number
  middle: number
  top: number
}

/** 메뉴 줄 위치를 모를 때 펼침 높이 비율 */
const TOP_RATIO = 0.88
/** 펼쳤을 때 메뉴 줄과 시트 사이 틈(px) */
export const TOP_GAP = 6
/** 기본 높이 비율. index.css의 --list-base와 같은 값(높이 700px 이하 폰은 38%) */
const MIDDLE_RATIO = 0.45
const MIDDLE_RATIO_SHORT = 0.38
const SHORT_VIEWPORT = 700
/** 이보다 빨리(px/ms) 놓으면 "툭 민 것"으로 보고 그 방향 다음 자리로 보낸다 */
export const FLICK_SPEED = 0.4

/**
 * collapsedPx: 접혔을 때 높이 = 손잡이 높이(화면에서 재서 넘긴다. 터치 화면은 손잡이가 더 크다)
 * menuBottom: 위 메뉴 줄(그래프·EQ·테마·설정)의 아래 끝(px). 주면 펼침 = 메뉴 줄 바로 아래까지
 *   (화면 비율로 정하면 폰마다 비교 탭 줄 한가운데가 잘려 어정쩡해 보였음)
 */
export function sheetSnaps(viewportHeight: number, collapsedPx: number, menuBottom?: number): SheetSnaps {
  const ratio = viewportHeight <= SHORT_VIEWPORT ? MIDDLE_RATIO_SHORT : MIDDLE_RATIO
  const middle = Math.round(viewportHeight * ratio)
  const top =
    menuBottom === undefined ? Math.round(viewportHeight * TOP_RATIO) : Math.round(viewportHeight - menuBottom - TOP_GAP)
  return {
    collapsed: Math.round(collapsedPx),
    middle,
    // 메뉴 줄이 아주 크거나 화면이 아주 낮아도 펼침이 중간보다는 높게
    top: Math.max(top, middle + 1),
  }
}

/** 끄는 중의 높이: 접힘~펼침 사이로 자른다(정수 px) */
export function clampListHeight(px: number, snaps: SheetSnaps): number {
  return Math.round(Math.min(snaps.top, Math.max(snaps.collapsed, px)))
}

const order = (s: SheetSnaps) => [s.collapsed, s.middle, s.top]

/** 지금 높이에서 가장 가까운 자리의 순번(0 접힘, 1 중간, 2 펼침) */
function nearestIndex(px: number, snaps: SheetSnaps): number {
  const list = order(snaps)
  let best = 0
  for (let i = 1; i < list.length; i++) if (Math.abs(list[i] - px) < Math.abs(list[best] - px)) best = i
  return best
}

/**
 * 손가락을 놓았을 때 갈 자리(px).
 * velocity: 놓기 직전 속도(px/ms, 위로 올리면 양수). 빠르면 그 방향의 다음 자리,
 * 느리면(천천히 끌다 놓음) 가장 가까운 자리
 */
export function releaseSnap(px: number, velocity: number, snaps: SheetSnaps): number {
  const list = order(snaps)
  if (velocity >= FLICK_SPEED) return list.find((s) => s > px + 1) ?? snaps.top
  if (velocity <= -FLICK_SPEED) return [...list].reverse().find((s) => s < px - 1) ?? snaps.collapsed
  return list[nearestIndex(px, snaps)]
}

/** 끌지 않고 눌렀을 때 갈 자리(px): 접힘→중간, 중간→펼침, 펼침→중간 */
export function tapSnap(px: number, snaps: SheetSnaps): number {
  return nearestIndex(px, snaps) === 1 ? snaps.top : snaps.middle
}
