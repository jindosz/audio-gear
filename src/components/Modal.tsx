// 여러 팝업이 함께 쓰는 틀: 제목, 닫기 버튼, 열고 닫기 처리
import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** ReactNode: 화면에 그릴 수 있는 모든 것(글자, 태그, 컴포넌트) */
  children: ReactNode
}

export function Modal({ open, onClose, title, children }: Props) {
  // useRef: 화면의 실제 HTML 요소(<dialog>)를 가리키는 손잡이
  const dialogRef = useRef<HTMLDialogElement>(null)

  // useEffect: 화면이 그려진 뒤 실행할 일. [open]이 바뀔 때마다 다시 실행된다
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal()은 첫 번째 버튼(✕)에 포커스를 주므로, data-autofocus 표시가 있는 입력칸으로 옮긴다
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    // onClose: Esc 키로 닫을 때도 부모의 open 상태를 false로 맞춘다
    <dialog ref={dialogRef} className="dialog" onClose={onClose}>
      <div className="dialog-head">
        <h2>{title}</h2>
        <button className="link" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>
      {/* 닫혀 있을 때는 내용을 그리지 않는다. 다시 열면 입력칸 등이 처음 상태로 돌아간다 */}
      {open && children}
    </dialog>
  )
}
