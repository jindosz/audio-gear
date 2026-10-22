// 켜고 끄는 버튼(체크박스 대신). 켜지면 버튼 전체가 파랗게 칠해진다.
// aria-pressed: 화면 낭독기에 "눌린 상태인지"를 알려준다(체크박스의 checked와 같은 역할)
import type { ReactNode } from 'react'

interface Props {
  on: boolean
  onChange: (on: boolean) => void
  children: ReactNode
  small?: boolean
  title?: string
}

export function ToggleButton({ on, onChange, children, small, title }: Props) {
  const className = ['toggle', on && 'on', small && 'small'].filter(Boolean).join(' ')
  return (
    <button type="button" className={className} aria-pressed={on} onClick={() => onChange(!on)} title={title}>
      {children}
    </button>
  )
}
