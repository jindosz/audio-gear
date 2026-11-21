// 세그먼트 버튼 묶음(여러 개 중 하나 고르기, 예: [헤드폰 | 이어폰]).
// 고른 칸 뒤의 떠오른 알약(indicator)을 하나만 두고, 다른 칸을 고르면 그 칸 자리로 스르륵 미끄러지게 한다.
// 쓰는 법: 예전 <div className="segmented">를 <SegmentedGroup className="...">로 바꾸고, 고른 버튼에는
// 지금처럼 className="active"를 붙인다. 알약의 위치·폭은 고른 버튼을 재서 CSS 변수(--seg-x, --seg-w)로 넘긴다
import { useLayoutEffect, useRef, type ReactNode } from 'react'

interface Props {
  className?: string
  /** 화면 낭독기용 묶음 이름 */
  label?: string
  children: ReactNode
}

export function SegmentedGroup({ className, label, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // useLayoutEffect: 화면에 그리기 직전에 실행(알약이 엉뚱한 자리에 한 번 보였다가 움직이는 깜빡임을 막음).
  // 의존성 배열이 없어서 그릴 때마다 고른 칸을 다시 잰다
  useLayoutEffect(() => {
    const box = ref.current
    if (!box) return
    const place = () => {
      const active = box.querySelector<HTMLElement>(':scope > button.active')
      if (!active) {
        box.classList.remove('seg-ready')
        return
      }
      box.style.setProperty('--seg-x', `${active.offsetLeft}px`)
      box.style.setProperty('--seg-w', `${active.offsetWidth}px`)
      box.style.setProperty('--seg-y', `${active.offsetTop}px`)
      box.style.setProperty('--seg-h', `${active.offsetHeight}px`)
      // 처음 자리를 잡을 때는 미끄러지지 않게, 다음 그림부터 움직이는 효과를 켠다
      if (!box.classList.contains('seg-ready')) {
        box.classList.add('seg-ready')
        requestAnimationFrame(() => box.classList.add('seg-animate'))
      }
    }
    place()
    // 폭이 바뀌면(화면 회전, 글꼴 늦게 불러옴) 다시 잰다
    const observer = new ResizeObserver(place)
    observer.observe(box)
    return () => observer.disconnect()
  })

  return (
    <div ref={ref} className={['segmented', 'seg-slide', className].filter(Boolean).join(' ')} role="group" aria-label={label}>
      {children}
    </div>
  )
}
