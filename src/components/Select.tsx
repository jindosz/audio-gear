// 선택 상자. 쓰는 법은 HTML <select>와 같다(value, onChange, 안에 <option>/<optgroup>).
// - PC(마우스): 브라우저 기본 <select> 그대로(촘촘하고 키보드로도 편함)
// - 손가락 화면(폰): 누르면 안드로이드 기본 목록(하얗고 네모난 라디오 목록) 대신
//   앱 모양에 맞춘 아래쪽 시트(Modal)가 올라와 고른 항목에 체크 표시를 한다
import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, ChevronDownIcon } from './Icons'
import { Modal } from './Modal'

/** onChange에 넘기는 값. 기존 코드의 e.target.value를 그대로 쓸 수 있게 <select>의 이벤트와 같은 모양 */
export interface SelectChange {
  target: { value: string }
}

interface Props {
  value: string | number
  onChange: (e: SelectChange) => void
  children: ReactNode
  disabled?: boolean
  title?: string
  'aria-label'?: string
  className?: string
}

interface Item {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface Group {
  label?: string
  items: Item[]
}

type OptionProps = { value?: string | number; children?: ReactNode; disabled?: boolean }
type GroupProps = { label?: string; children?: ReactNode }

/** <option>/<optgroup> 자식들을 시트에 그릴 목록으로 바꾼다. 묶음 밖의 option은 이름 없는 묶음에 모은다 */
function parseOptions(children: ReactNode): Group[] {
  const groups: Group[] = []
  let loose: Group | null = null
  const walk = (nodes: ReactNode, inGroup: Group | null) => {
    Children.forEach(nodes, (node) => {
      if (!isValidElement(node)) return
      const el = node as ReactElement<OptionProps & GroupProps>
      if (el.type === Fragment) return walk(el.props.children, inGroup)
      if (el.type === 'optgroup') {
        const group: Group = { label: el.props.label, items: [] }
        groups.push(group)
        loose = null
        return walk(el.props.children, group)
      }
      if (el.type === 'option') {
        const item = { value: String(el.props.value ?? ''), label: el.props.children, disabled: el.props.disabled }
        if (inGroup) inGroup.items.push(item)
        else {
          if (!loose) {
            loose = { items: [] }
            groups.push(loose)
          }
          loose.items.push(item)
        }
      }
    })
  }
  walk(children, null)
  return groups.filter((g) => g.items.length > 0)
}

/** 손가락 화면인지(pointer: coarse). 화면이 바뀌면(태블릿에 마우스 연결 등) 따라 바뀐다 */
const COARSE = '(pointer: coarse)'
function subscribe(onChange: () => void) {
  const mq = window.matchMedia(COARSE)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
const useCoarsePointer = () => useSyncExternalStore(subscribe, () => window.matchMedia(COARSE).matches)

export function Select({ value, onChange, children, disabled, title, className, ...rest }: Props) {
  const coarse = useCoarsePointer()
  const [open, setOpen] = useState(false)
  const [sheetTitle, setSheetTitle] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const ariaLabel = rest['aria-label']

  // 시트가 열리면 고른 항목이 보이게 가운데로 스크롤
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() =>
      listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' }),
    )
    return () => cancelAnimationFrame(id)
  }, [open])

  if (!coarse) {
    return (
      <select
        value={value}
        onChange={(e) => onChange({ target: { value: e.target.value } })}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        className={className}
      >
        {children}
      </select>
    )
  }

  const groups = parseOptions(children)
  const current = String(value)
  const selected = groups.flatMap((g) => g.items).find((i) => i.value === current)

  function openSheet() {
    // 시트 제목: aria-label → title → 감싼 <label>의 앞 글자("타깃", "차이 기준" 등) → "선택"
    const labelText = buttonRef.current?.closest('label')?.firstChild?.textContent?.trim()
    setSheetTitle(ariaLabel ?? title ?? (labelText || '선택'))
    setOpen(true)
  }

  function pick(item: Item) {
    setOpen(false)
    if (item.value !== current) onChange({ target: { value: item.value } })
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={['select-button', className].filter(Boolean).join(' ')}
        onClick={openSheet}
        disabled={disabled}
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
      >
        <span className="select-value">{selected?.label ?? ''}</span>
        <ChevronDownIcon size={16} />
      </button>
      {/* createPortal: 시트를 <body> 끝에 그린다. 선택 상자가 <label> 안에 있으면 시트의 빈 곳을 눌렀을 때
          브라우저가 label 클릭으로 보고 선택 상자를 다시 눌러 버리기 때문 */}
      {createPortal(
        <Modal open={open} onClose={() => setOpen(false)} title={sheetTitle}>
          <ul className="select-sheet" role="listbox" ref={listRef}>
            {groups.map((g, gi) => (
              <li key={gi} className="select-group">
                {g.label && <div className="select-group-label">{g.label}</div>}
                <ul>
                  {g.items.map((item) => {
                    const isSelected = item.value === current
                    return (
                      <li key={item.value}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={isSelected ? 'select-option active' : 'select-option'}
                          disabled={item.disabled}
                          onClick={() => pick(item)}
                        >
                          <span>{item.label}</span>
                          {isSelected && <CheckIcon size={18} />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </Modal>,
        document.body,
      )}
    </>
  )
}
