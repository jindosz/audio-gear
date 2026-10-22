// 왼쪽 메뉴: 카테고리(헤드폰/이어폰) 전환과 설정
import { categoryLabels } from '../labels'
import type { DeviceCategory } from '../types'
import { EarphoneIcon, HeadphoneIcon, SettingsIcon } from './Icons'

interface Props {
  category: DeviceCategory
  onChange: (category: DeviceCategory) => void
}

const icons: Record<DeviceCategory, () => React.JSX.Element> = {
  headphone: HeadphoneIcon,
  iem: EarphoneIcon,
}

export function Sidebar({ category, onChange }: Props) {
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
      {/* 설정 화면은 아직 없다(다크/라이트 전환, 백업 등이 들어갈 자리) */}
      <button className="nav-item settings" disabled title="설정 (준비 중)">
        <SettingsIcon />
      </button>
    </nav>
  )
}
