// 폰 화면: 아래쪽 기기 목록 맨 위의 손잡이. 잡고 위아래로 끌면 목록 높이가 바뀌고, 끌지 않고 누르면 펼치기/기본 높이.
// 높이는 .app의 CSS 변수 --list-h에 px로 적는다. 목록 칸 높이와 그래프 높이 계산이 모두 이 변수를 쓴다(index.css).
// 끝을 알 수 없는 마우스·손가락 동작을 한 번에 다루려고 포인터 이벤트(pointerdown/move/up)를 쓴다
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { clampListHeight, tapTarget } from '../listHeight'

/** 끌었다고 볼 최소 이동 거리(px). 이보다 적게 움직이면 "누름"으로 본다 */
const DRAG_THRESHOLD = 5
/** 키보드 ↑/↓로 한 번에 바꾸는 높이(px) */
const KEY_STEP = 48

export function ListGrip() {
  // 끄는 중의 정보. 화면을 다시 그릴 필요가 없어 state 대신 ref에 둔다
  const drag = useRef<{ startY: number; startHeight: number; moved: boolean } | null>(null)

  const listCol = (el: HTMLElement) => el.closest<HTMLElement>('.list-col')
  const app = (el: HTMLElement) => el.closest<HTMLElement>('.app')

  /** 목록 높이를 px로 정한다. null이면 CSS 기본값으로 돌린다 */
  function setHeight(el: HTMLElement, px: number | null) {
    const root = app(el)
    if (!root) return
    if (px === null) root.style.removeProperty('--list-h')
    else root.style.setProperty('--list-h', `${px}px`)
  }

  /** 목록 위쪽 부품(손잡이·헤드폰/이어폰·검색창·필터)의 높이 = 목록 칸 맨 위에서 스크롤 칸 시작까지. 이보다 낮추면 부품이 눌려 겹친다 */
  function headerHeight(el: HTMLElement) {
    const col = listCol(el)
    const scroll = col?.querySelector<HTMLElement>('.list-scroll')
    if (!col || !scroll) return 0
    return scroll.getBoundingClientRect().top - col.getBoundingClientRect().top
  }

  function currentHeight(el: HTMLElement) {
    return listCol(el)?.getBoundingClientRect().height ?? 0
  }

  function handlePointerDown(e: PointerEvent<HTMLButtonElement>) {
    // 손가락이 손잡이 밖으로 나가도 계속 이 버튼이 움직임을 받게 한다
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startY: e.clientY, startHeight: currentHeight(e.currentTarget), moved: false }
  }

  function handlePointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current
    if (!d) return
    const dy = d.startY - e.clientY // 위로 올리면 양수 → 목록이 커진다
    if (!d.moved && Math.abs(dy) < DRAG_THRESHOLD) return
    d.moved = true
    setHeight(e.currentTarget, clampListHeight(d.startHeight + dy, window.innerHeight, headerHeight(e.currentTarget)))
  }

  function handlePointerUp(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current
    drag.current = null
    if (d && !d.moved) setHeight(e.currentTarget, tapTarget(d.startHeight, window.innerHeight))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const step = e.key === 'ArrowUp' ? KEY_STEP : -KEY_STEP
    setHeight(e.currentTarget, clampListHeight(currentHeight(e.currentTarget) + step, window.innerHeight, headerHeight(e.currentTarget)))
  }

  return (
    <button
      type="button"
      className="list-grip mobile-only"
      aria-label="목록 높이 조절: 위아래로 끌거나 누르세요"
      title="위아래로 끌어 목록 높이 조절, 누르면 펼치기/되돌리기"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={handleKeyDown}
    >
      <span className="grip-bar" aria-hidden="true" />
    </button>
  )
}
