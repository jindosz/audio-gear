// 손가락으로 빠르게 옆으로 밀면 옆 칸으로 넘긴다. 판단은 swipe.ts(순수 함수).
// 비교 칸(그래프·툴바) → 옆 비교 탭, 기기 목록 → 헤드폰/이어폰
// 손가락(touch)만: PC 마우스로 끄는 건 그래프 값 보기로 남겨 둔다.
// 위아래 스크롤은 브라우저가 맡고(CSS touch-action: pan-y), 옆으로 미는 것만 여기서 본다
import { useEffect, type RefObject } from 'react'
import { swallowNextClick } from '../swallowClick'
import { neighborTab, swipeStep } from '../swipe'

export function useSwipeTabs(
  ref: RefObject<HTMLElement | null>,
  tabIds: string[],
  activeId: string | undefined,
  onSelect: (id: string) => void,
): void {
  useEffect(() => {
    const el = ref.current
    if (!el || tabIds.length < 2) return
    let start: { x: number; y: number; t: number; id: number } | null = null

    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !e.isPrimary) return
      // 슬라이더·선택 상자를 끄는 건 넘기기가 아님. 탭 줄은 자체로 옆 스크롤이 있어서 제외.
      // 팝업(<dialog>)은 화면에선 맨 위에 떠 있어도 DOM으로는 이 칸 안에 있어서, 팝업 안에서 민 것도 제외
      const target = e.target as HTMLElement
      if (target.closest('input, select, textarea, .tabbar, dialog')) return
      start = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId }
    }
    const up = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return
      const step = swipeStep(e.clientX - start.x, e.clientY - start.y, e.timeStamp - start.t)
      start = null
      if (!step) return
      const next = neighborTab(tabIds, activeId, step)
      if (!next) return
      swallowNextClick() // 뗀 자리의 버튼이 눌리지 않게
      onSelect(next)
    }
    // 브라우저가 스크롤로 가져가면(pointercancel) 넘기기 아님
    const cancel = () => {
      start = null
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', cancel)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', cancel)
    }
  }, [ref, tabIds, activeId, onSelect])
}
