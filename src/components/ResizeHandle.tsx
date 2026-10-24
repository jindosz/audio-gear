// 기기 목록 칸의 오른쪽 경계. 끌어서 폭을 바꾸고, 두 번 누르면 기본 폭으로 돌아간다.
// 키보드로도 조절할 수 있다(포커스 후 ←/→)
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'

interface Props {
  width: number
  min: number
  max: number
  /** 두 번 눌렀을 때 돌아갈 폭 */
  defaultWidth: number
  onChange: (width: number) => void
}

export function ResizeHandle({ width, min, max, defaultWidth, onChange }: Props) {
  const clamp = (w: number) => Math.round(Math.min(max, Math.max(min, w)))
  // 끌기 시작한 순간의 마우스 위치와 폭. 끄는 동안 움직인 거리만큼 폭을 바꾼다
  const drag = useRef<{ x: number; width: number } | null>(null)

  function handleDown(e: PointerEvent<HTMLDivElement>) {
    // pointer capture: 마우스가 경계선 밖으로 빠르게 나가도 계속 이 요소가 움직임을 받는다
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, width }
    document.body.classList.add('resizing') // 끄는 동안 글자가 선택되지 않게
  }

  function handleMove(e: PointerEvent<HTMLDivElement>) {
    if (drag.current) onChange(clamp(drag.current.width + e.clientX - drag.current.x))
  }

  function handleUp() {
    drag.current = null
    document.body.classList.remove('resizing')
  }

  function handleKey(e: KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? 40 : 10
    if (e.key === 'ArrowLeft') onChange(clamp(width - step))
    else if (e.key === 'ArrowRight') onChange(clamp(width + step))
    else return
    e.preventDefault()
  }

  return (
    <div
      className="resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="기기 목록 폭"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title="끌어서 폭 조절, 두 번 누르면 원래 폭"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onDoubleClick={() => onChange(defaultWidth)}
      onKeyDown={handleKey}
    />
  )
}
