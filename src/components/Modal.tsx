// 여러 팝업이 함께 쓰는 틀: 제목, 닫기 버튼, 열고 닫기 처리.
// 열 때는 CSS 애니메이션(index.css의 dialog-in)으로 스르륵 나타나고,
// 닫을 때는 .closing을 붙여 사라지는 애니메이션이 끝난 뒤 실제로 닫는다(CLOSE_MS).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CloseIcon } from './Icons'

interface Props {
  open: boolean
  onClose: () => void
  title: ReactNode
  /** ReactNode: 화면에 그릴 수 있는 모든 것(글자, 태그, 컴포넌트) */
  children: ReactNode
}

/** 사라지는 애니메이션 길이(ms). index.css의 dialog-out과 같게 */
const CLOSE_MS = 180

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Modal({ open, onClose, title, children }: Props) {
  // useRef: 화면의 실제 HTML 요소(<dialog>)를 가리키는 손잡이
  const dialogRef = useRef<HTMLDialogElement>(null)
  // 닫히는 애니메이션 동안(closing)에도 내용을 그려 둔다. open이 true→false로 바뀌는 순간 closing을 켠다
  // (렌더 중에 이전 값과 비교해 상태를 맞추는 방법: React 문서의 "props가 바뀔 때 state 조정")
  const [prevOpen, setPrevOpen] = useState(open)
  const [closing, setClosing] = useState(false)
  // 닫히는 동안 보여줄 마지막 내용. 부모가 닫으면서 내용을 바로 비우는 팝업(기기 상세 등)도 있어서,
  // 열려 있을 때의 내용을 기억해 두었다가 사라지는 애니메이션 동안 보여준다
  const [lastChildren, setLastChildren] = useState<ReactNode>(children)
  if (open !== prevOpen) {
    setPrevOpen(open)
    setClosing(!open)
  }
  if (open && children !== lastChildren) setLastChildren(children)

  // useEffect: 화면이 그려진 뒤 실행할 일. [open]이 바뀔 때마다 다시 실행된다
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      dialog.classList.remove('closing')
      if (!dialog.open) {
        dialog.showModal()
        // showModal()은 첫 번째 버튼(✕)에 포커스를 주므로, data-autofocus 표시가 있는 입력칸으로 옮긴다
        dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
      }
      return
    }
    // 닫기: 사라지는 애니메이션(.closing)을 보여준 뒤 실제로 닫는다. 이미 닫혔거나 움직임 줄이기면 바로
    const animate = dialog.open && !reducedMotion()
    if (animate) dialog.classList.add('closing')
    const timer = setTimeout(
      () => {
        dialog.classList.remove('closing')
        if (dialog.open) dialog.close()
        setClosing(false)
      },
      animate ? CLOSE_MS : 0,
    )
    return () => clearTimeout(timer)
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      // Esc·뒤로 가기(backButton.ts)는 "cancel" 신호를 보낸다. 바로 닫지 않고 부모에게 닫아 달라고 해서
      // 위의 사라지는 애니메이션을 거치게 한다
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // 혹시 다른 방법으로 바로 닫혔을 때도 부모의 open 상태를 false로 맞춘다
      onClose={() => {
        if (open) onClose()
      }}
      // 팝업 바깥(어두운 배경)을 누르면 닫기. 배경을 눌러도 클릭 대상은 <dialog> 자신이라,
      // 누른 위치가 팝업 상자 밖인지로 판단한다(팝업 안의 빈 곳을 눌러 닫히지 않게)
      onClick={(e) => {
        if (e.target !== e.currentTarget) return
        const r = e.currentTarget.getBoundingClientRect()
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
        if (!inside) onClose()
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button className="link icon-close" onClick={onClose} aria-label="닫기">
          <CloseIcon size={20} />
        </button>
      </div>
      {/* 닫혀 있을 때는 내용을 그리지 않는다. 다시 열면 입력칸 등이 처음 상태로 돌아간다 */}
      {open ? children : closing ? lastChildren : null}
    </dialog>
  )
}
