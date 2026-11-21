// 폰 화면: 아래쪽 기기 목록(시트) 맨 위의 손잡이.
// - 끌면 손가락을 따라 높이가 바뀌고, 놓으면 접힘·중간·펼침 중 한 자리로 스르륵 붙는다(빨리 툭 밀면 그 방향 다음 자리)
// - 끌지 않고 누르면 접힘→중간, 중간→펼침, 펼침→중간
// 높이는 .app의 CSS 변수 --list-h에 px로 적는다(중간 자리는 CSS 기본값으로 되돌림). 움직이는 효과는 CSS transition이 맡고,
// 끄는 동안에는 .app에 sheet-dragging을 붙여 효과를 꺼서 손가락을 바로 따라오게 한다.
// 끝을 알 수 없는 마우스·손가락 동작을 한 번에 다루려고 포인터 이벤트(pointerdown/move/up)를 쓴다
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { clampListHeight, releaseSnap, sheetSnaps, tapSnap, type SheetSnaps } from '../listHeight'

/** 끌었다고 볼 최소 이동 거리(px). 이보다 적게 움직이면 "누름"으로 본다 */
const DRAG_THRESHOLD = 6
/** 놓을 때 속도는 마지막 이만큼(ms)의 움직임으로 잰다 */
const VELOCITY_WINDOW = 100

interface Drag {
  startY: number
  startHeight: number
  moved: boolean
  /** 최근 위치 기록(속도 계산용) */
  samples: { t: number; y: number }[]
}

/**
 * 손잡이를 누르고 뗀 직후 브라우저가 보내는 "클릭"을 한 번 버린다.
 * 시트가 움직이는 사이 손가락 아래로 기기 줄이 들어와, 그 줄이 눌린 것처럼 선택되는 일을 막는다
 */
function swallowNextClick() {
  const stop = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
  }
  window.addEventListener('click', stop, { capture: true, once: true })
  // 클릭이 오지 않는 경우(끌다가 화면 밖에서 뗌 등)를 위해 잠시 뒤 지운다
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 400)
}

export function ListGrip() {
  // 끄는 중의 정보. 화면을 다시 그릴 필요가 없어 state 대신 ref에 둔다
  const drag = useRef<Drag | null>(null)

  const listCol = (el: HTMLElement) => el.closest<HTMLElement>('.list-col')
  const app = (el: HTMLElement) => el.closest<HTMLElement>('.app')

  const snapsFor = (el: HTMLElement): SheetSnaps => sheetSnaps(window.innerHeight, el.offsetHeight)

  /** 목록 높이를 px로 정한다. 중간 자리는 CSS 기본값(화면 비율)으로 돌려 화면 회전에도 맞게 한다 */
  function setHeight(el: HTMLElement, px: number) {
    const root = app(el)
    if (!root) return
    if (px === snapsFor(el).middle) root.style.removeProperty('--list-h')
    else root.style.setProperty('--list-h', `${px}px`)
  }

  function setDragging(el: HTMLElement, on: boolean) {
    app(el)?.classList.toggle('sheet-dragging', on)
  }

  function currentHeight(el: HTMLElement) {
    return listCol(el)?.getBoundingClientRect().height ?? 0
  }

  function handlePointerDown(e: PointerEvent<HTMLButtonElement>) {
    // 손가락이 손잡이 밖으로 나가도 계속 이 버튼이 움직임을 받게 한다
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = {
      startY: e.clientY,
      startHeight: currentHeight(e.currentTarget),
      moved: false,
      samples: [{ t: e.timeStamp, y: e.clientY }],
    }
  }

  function handlePointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current
    if (!d) return
    const dy = d.startY - e.clientY // 위로 올리면 양수 → 목록이 커진다
    if (!d.moved && Math.abs(dy) < DRAG_THRESHOLD) return
    if (!d.moved) setDragging(e.currentTarget, true)
    d.moved = true
    d.samples.push({ t: e.timeStamp, y: e.clientY })
    d.samples = d.samples.filter((s) => e.timeStamp - s.t <= VELOCITY_WINDOW)
    const el = e.currentTarget
    const root = app(el)
    root?.style.setProperty('--list-h', `${clampListHeight(d.startHeight + dy, snapsFor(el))}px`)
  }

  function handlePointerUp(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current
    drag.current = null
    if (!d) return
    const el = e.currentTarget
    setDragging(el, false) // 여기서부터는 CSS 효과로 스르륵 움직인다
    swallowNextClick()
    const snaps = snapsFor(el)
    if (!d.moved) {
      setHeight(el, tapSnap(d.startHeight, snaps))
      return
    }
    // 속도(px/ms, 위로 양수) = 최근 기록의 처음과 지금 사이 이동 거리 ÷ 시간
    const first = d.samples[0]
    const dt = e.timeStamp - first.t
    const velocity = dt > 0 ? (first.y - e.clientY) / dt : 0
    setHeight(el, releaseSnap(currentHeight(el), velocity, snaps))
  }

  function handlePointerCancel(e: PointerEvent<HTMLButtonElement>) {
    drag.current = null
    setDragging(e.currentTarget, false)
    const el = e.currentTarget
    setHeight(el, releaseSnap(currentHeight(el), 0, snapsFor(el)))
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const el = e.currentTarget
    // 키보드: 한 칸씩 위/아래 자리로(빨리 민 것처럼 계산)
    setHeight(el, releaseSnap(currentHeight(el), e.key === 'ArrowUp' ? 1 : -1, snapsFor(el)))
  }

  return (
    <button
      type="button"
      className="list-grip mobile-only"
      aria-label="목록 높이 조절: 위아래로 끌거나 누르세요"
      title="위아래로 끌거나 툭 밀어 목록 높이 조절, 누르면 펼치기/되돌리기"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
    >
      <span className="grip-bar" aria-hidden="true" />
    </button>
  )
}
