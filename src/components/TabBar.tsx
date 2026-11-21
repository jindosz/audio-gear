// 메인 영역 위쪽의 비교 탭 줄: 탭 전환, 닫기(✕), 새 탭(+)
import { createTab, deleteTab } from '../repo'
import type { CompareTab } from '../types'
import { CloseIcon, PlusIcon } from './Icons'
import { askConfirm } from '../confirm'

interface Props {
  tabs: CompareTab[]
  activeId: string | undefined
  onSelect: (id: string) => void
}

export function TabBar({ tabs, activeId, onSelect }: Props) {
  async function handleAdd() {
    onSelect(await createTab())
  }

  async function handleClose(tab: CompareTab) {
    if (
      tab.selections.length > 0 &&
      !(await askConfirm({ title: '탭 닫기', message: `"${tab.name}" 탭을 닫을까요? 이 탭의 선택이 사라져요.`, ok: '닫기' }))
    )
      return
    // 보고 있던 탭을 닫으면 옆 탭(오른쪽, 없으면 왼쪽)으로 옮긴다
    if (tab.id === activeId) {
      const index = tabs.findIndex((t) => t.id === tab.id)
      const neighbor = tabs[index + 1] ?? tabs[index - 1]
      if (neighbor) onSelect(neighbor.id)
    }
    await deleteTab(tab.id)
  }

  return (
    // role="tablist"/"tab": 화면 낭독기에 "탭 묶음"이라는 걸 알려주는 표시
    <div className="tabbar" role="tablist">
      {tabs.map((tab) => (
        <div key={tab.id} className={tab.id === activeId ? 'tab active' : 'tab'}>
          <button
            className="tab-name"
            role="tab"
            aria-selected={tab.id === activeId}
            onClick={() => onSelect(tab.id)}
          >
            {tab.name}
            {tab.selections.length > 0 && <span className="tab-count">{tab.selections.length}</span>}
          </button>
          <button className="tab-close" onClick={() => handleClose(tab)} aria-label={`${tab.name} 닫기`} title="탭 닫기">
            <CloseIcon size={14} />
          </button>
        </div>
      ))}
      <button className="tab-add" onClick={handleAdd} aria-label="새 비교 탭" title="새 비교 탭">
        <PlusIcon />
      </button>
    </div>
  )
}
