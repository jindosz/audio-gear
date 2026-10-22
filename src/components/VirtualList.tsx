// 가상 스크롤 목록: 항목이 수천 개여도 지금 화면에 보이는 줄(+ 위아래 몇 줄)만 실제로 그린다.
// 원리: 목록 전체 높이(항목 수 × 줄 높이)만큼 빈 공간을 만들어 스크롤바는 그대로 두고,
// 보이는 범위의 줄만 그 공간 안의 정확한 위치(top)에 놓는다. 그래서 모든 줄의 높이가 같아야 한다.
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'

interface Props<T> {
  items: T[]
  /** 줄 하나의 높이(px). CSS의 줄 높이와 같아야 한다 */
  rowHeight: number
  /** 실제로 스크롤되는 바깥 요소 */
  scrollRef: RefObject<HTMLElement | null>
  getKey: (item: T) => string
  /** 줄 하나를 그린다. style(위치)을 그 줄의 <li>에 꼭 붙여야 한다 */
  renderRow: (item: T, style: CSSProperties) => ReactNode
}

/** 화면 밖이지만 미리 그려 둘 줄 수(빠르게 스크롤할 때 빈 칸이 보이지 않게) */
const OVERSCAN = 8

// <T,>: "어떤 타입의 목록이든 받는다"는 제네릭 컴포넌트. 쉼표는 JSX 태그와 헷갈리지 않게 하는 표시
export function VirtualList<T,>({ items, rowHeight, scrollRef, getKey, renderRow }: Props<T>) {
  const listRef = useRef<HTMLUListElement>(null)
  const [range, setRange] = useState({ start: 0, end: 0 })

  // 스크롤, 크기 변화, 위쪽 구역(선택됨 등) 높이 변화가 있을 때마다 보이는 범위를 다시 계산한다.
  // 위쪽 구역이 바뀌면 목록 위치도 바뀌므로, 화면을 그릴 때마다 감시 대상을 다시 연결한다(의존성 배열 없음).
  useEffect(() => {
    const scrollEl = scrollRef.current
    const list = listRef.current
    if (!scrollEl || !list) return

    const update = () => {
      // 목록 맨 위가 스크롤 영역의 보이는 맨 위에서 얼마나 떨어져 있는지(위로 지나갔으면 음수)
      const top = list.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top
      const start = Math.max(0, Math.floor(-top / rowHeight) - OVERSCAN)
      const end = Math.min(items.length, Math.ceil((scrollEl.clientHeight - top) / rowHeight) + OVERSCAN)
      // 값이 같으면 이전 객체를 그대로 돌려줘서 불필요한 다시 그리기를 막는다
      setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end: Math.max(start, end) }))
    }

    scrollEl.addEventListener('scroll', update, { passive: true })
    // ResizeObserver: 요소 크기가 바뀌면 알려준다. 연결하는 순간에도 한 번 알려줘서 첫 계산이 된다
    const observer = new ResizeObserver(update)
    observer.observe(scrollEl)
    for (const child of scrollEl.children) observer.observe(child)
    return () => {
      scrollEl.removeEventListener('scroll', update)
      observer.disconnect()
    }
  })

  return (
    <ul ref={listRef} className="virtual-list" style={{ height: items.length * rowHeight }}>
      {items.slice(range.start, range.end).map((item, i) => (
        // key: React가 줄을 구분하는 이름표. 스크롤해도 같은 항목은 같은 key라 다시 만들지 않는다
        <Fragment key={getKey(item)}>
          {renderRow(item, { position: 'absolute', top: (range.start + i) * rowHeight, height: rowHeight, left: 0, right: 0 })}
        </Fragment>
      ))}
    </ul>
  )
}
