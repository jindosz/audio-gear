// 짧은 안내(토스트)를 그리는 자리(App에 하나). 여는 것은 src/toast.ts의 showToast.
// 나타날 때 아래에서 살짝 떠오르고, 시간이 지나면 흐려지며 사라진다
import { useEffect, useRef, useState } from 'react'
import { setToastHandler } from '../toast'

export function ToastHost() {
  const [message, setMessage] = useState('')
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    setToastHandler((text, ms) => {
      setMessage(text)
      setVisible(true)
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
    <div className={visible ? 'quick-toast show' : 'quick-toast'} role="status" aria-hidden={!visible}>
      {message}
    </div>
  )
}
