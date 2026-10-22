// 비교 선택과 색 배정 규칙. 화면·DB와 상관없는 순수 함수라 따로 테스트할 수 있다.
//
// 색은 실제 색 값이 아니라 팔레트 순번(colorIndex)만 저장한다.
// 실제 색은 index.css의 --series-0 ~ --series-7 (라이트/다크 따로 정의).
import type { CompareSelection } from './types'

/** 팔레트 색 개수 = 동시에 비교할 수 있는 최대 개수 */
export const PALETTE_SIZE = 8

/** CSS에서 쓸 색 이름. 예: var(--series-0) */
export function seriesColor(colorIndex: number): string {
  return `var(--series-${colorIndex})`
}

/** 아직 아무도 쓰지 않는 첫 번째 색 순번. 다 쓰고 있으면 null */
export function firstFreeColor(selections: CompareSelection[], size = PALETTE_SIZE): number | null {
  const used = new Set(selections.map((s) => s.colorIndex))
  for (let i = 0; i < size; i++) {
    if (!used.has(i)) return i
  }
  return null
}

/** 측정치를 선택 목록에 추가한다. 이미 있으면 그대로, 색이 모자라면 null */
export function addSelection(
  selections: CompareSelection[],
  measurementId: string,
  size = PALETTE_SIZE,
): CompareSelection[] | null {
  if (selections.some((s) => s.measurementId === measurementId)) return selections
  const colorIndex = firstFreeColor(selections, size)
  if (colorIndex === null) return null
  return [...selections, { measurementId, colorIndex }]
}

/** 선택을 뺀다. 다른 항목의 색은 그대로 둔다(빈 색은 다음 선택이 채움) */
export function removeSelection(selections: CompareSelection[], measurementIds: string[]): CompareSelection[] {
  return selections.filter((s) => !measurementIds.includes(s.measurementId))
}
