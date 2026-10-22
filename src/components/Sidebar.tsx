// 왼쪽 메뉴: 카테고리(헤드폰/이어폰) 전환과 설정
import { categoryLabels } from '../labels'
import type { DeviceCategory } from '../types'
import { EarphoneIcon, HeadphoneIcon, SettingsIcon } from './Icons'

interface Props {
  category: DeviceCategory
  onChange: (category: DeviceCategory) => void
  onOpenSettings: () => void
}

const icons: Record<DeviceCategory, () => React.JSX.Element> = {
  headphone: HeadphoneIcon,
  iem: EarphoneIcon,
}

export function Sidebar({ category, onChange, onOpenSettings }: Props) {
  return (
    <nav className="sidebar">
      {(Object.keys(categoryLabels) as DeviceCategory[]).map((c) => {
        const Icon = icons[c]
        return (
          <button
            key={c}
            className={c === category ? 'nav-item active' : 'nav-item'}
            onClick={() => onChange(c)}
            aria-pressed={c === category}
          >
            <Icon />
            <span>{categoryLabels[c]}</span>
          </button>
        )
      })}
      <button className="nav-item settings" onClick={onOpenSettings} title="설정 (백업 등)" aria-label="설정">
        <SettingsIcon />
      </button>
    </nav>
  )
}
