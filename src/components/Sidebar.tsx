// 왼쪽 메뉴: 카테고리(헤드폰/이어폰) 전환, EQ 화면, 설정
import { categoryLabels } from '../labels'
import type { DeviceCategory } from '../types'
import { EarphoneIcon, EqIcon, HeadphoneIcon, SettingsIcon } from './Icons'

/** 오른쪽에 보이는 화면: 기기 목록과 비교 그래프, 또는 EQ */
export type Page = 'devices' | 'eq'

interface Props {
  category: DeviceCategory
  page: Page
  onChange: (category: DeviceCategory) => void
  onOpenEq: () => void
  onOpenSettings: () => void
}

const icons: Record<DeviceCategory, () => React.JSX.Element> = {
  headphone: HeadphoneIcon,
  iem: EarphoneIcon,
}

export function Sidebar({ category, page, onChange, onOpenEq, onOpenSettings }: Props) {
  return (
    <nav className="sidebar">
      {(Object.keys(categoryLabels) as DeviceCategory[]).map((c) => {
        const Icon = icons[c]
        const active = page === 'devices' && c === category
        return (
          <button key={c} className={active ? 'nav-item active' : 'nav-item'} onClick={() => onChange(c)} aria-pressed={active}>
            <Icon />
            <span>{categoryLabels[c]}</span>
          </button>
        )
      })}
      <button className={page === 'eq' ? 'nav-item active' : 'nav-item'} onClick={onOpenEq} aria-pressed={page === 'eq'}>
        <EqIcon />
        <span>EQ</span>
      </button>
      <button className="nav-item settings" onClick={onOpenSettings} title="설정 (백업 등)" aria-label="설정">
        <SettingsIcon />
      </button>
    </nav>
  )
}
