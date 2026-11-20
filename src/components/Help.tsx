// 접어 둔 도움말: "ⓘ 도움말"을 누르면 설명이 펼쳐진다. 화면에 늘 보이는 글을 줄이려고 쓴다.
// <details>/<summary>는 누르면 펼치고 접는 HTML 기본 요소라 따로 상태 관리가 필요 없다
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** 접힌 상태에서 보이는 글. 기본 "도움말" */
  label?: string
}

export function Help({ children, label = '도움말' }: Props) {
  return (
    <details className="help">
      <summary>ⓘ {label}</summary>
      <div className="help-body">{children}</div>
    </details>
  )
}
