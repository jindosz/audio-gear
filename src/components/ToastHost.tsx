// 짧은 안내(토스트)를 그리는 자리(App에 하나). 여는 것은 src/toast.ts의 showToast.
// 나타날 때 아래에서 살짝 떠오르고, 시간이 지나면 흐려지며 사라진다.
// 팝업(<dialog>)은 화면 맨 위 층(top layer)에 그려져서 보통 요소는 z-index와 상관없이 그 뒤에 가린다(설정 팝업에서 띄운
// "최신 버전이에요"가 안 보였음). 그래서 토스트를 popover로 만들어, 띄울 때마다 맨 위 층의 가장 위로 다시 올린다
import { useEffect, useRef, useState } from 'react'
import { setToastHandler } from '../toast'

/** 맨 위 층의 가장 위로(그 사이에 열린 팝업보다 위). popover를 모르는 오래된 브라우저는 그대로(팝업 뒤에 가릴 수 있음) */
function raise(node: HTMLDivElement | null) {
  if (!node || typeof node.showPopover !== 'function') return
  try {
    if (node.matches(':popover-open')) node.hidePopover()
    node.showPopover()
  } catch {
    // 화면에서 빠진 순간 등은 무시
  }
}

export function ToastHost() {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const el = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setToastHandler((text, ms) => {
      setMessage(text)
      setVisible(true)
      raise(el.current)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setVisible(false), ms)
    })
    return () => {
      setToastHandler(null)
      clearTimeout(timer.current)
    }
  }, [])

  // role="status": 화면 낭독기가 내용을 읽어 준다. 사라질 때는 CSS로 흐려지기만 하고 자리는 그대로 둔다
  return (
    <div ref={el} popover="manual" className={visible ? 'quick-toast show' : 'quick-toast'} role="status" aria-hidden={!visible}>
      {message}
    </div>
  )
}
