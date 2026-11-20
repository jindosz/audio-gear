// 왼쪽 메뉴: 카테고리(헤드폰/이어폰) 전환, EQ 화면, 설정
import { categoryLabels } from '../labels'
import type { DeviceCategory } from '../types'
import { setThemePref, useResolvedTheme } from '../theme'
import { EarphoneIcon, EqIcon, GraphIcon, HeadphoneIcon, MoonIcon, SettingsIcon, SunIcon } from './Icons'

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
  // 테마 버튼: 지금 보이는 테마의 반대로 바로 바꾼다. "시스템 설정 따르기"는 설정 팝업에서 고른다
  const theme = useResolvedTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  const themeLabel = next === 'dark' ? '다크 모드로' : '라이트 모드로'
  return (
    <nav className="sidebar">
      {(Object.keys(categoryLabels) as DeviceCategory[]).map((c) => {
        const Icon = icons[c]
        const active = page === 'devices' && c === category
        return (
          <button key={c} className={active ? 'nav-item category active' : 'nav-item category'} onClick={() => onChange(c)} aria-pressed={active}>
            <Icon />
            <span>{categoryLabels[c]}</span>
          </button>
        )
      })}
      {/* 폰에서만 보임: 헤드폰/이어폰 버튼이 목록 위로 옮겨 가므로, EQ 화면에서 돌아올 버튼 */}
      <button
        className={page === 'devices' ? 'nav-item mobile-only active' : 'nav-item mobile-only'}
        onClick={() => onChange(category)}
        aria-pressed={page === 'devices'}
      >
        <GraphIcon />
        <span>그래프</span>
      </button>
      <button className={page === 'eq' ? 'nav-item active' : 'nav-item'} onClick={onOpenEq} aria-pressed={page === 'eq'}>
        <EqIcon />
        <span>EQ</span>
      </button>
      <button className="nav-item theme" onClick={() => setThemePref(next)} title={themeLabel} aria-label={themeLabel}>
        {next === 'dark' ? <MoonIcon /> : <SunIcon />}
      </button>
      <button className="nav-item settings" onClick={onOpenSettings} title="설정 (백업·테마 등)" aria-label="설정">
        <SettingsIcon />
      </button>
    </nav>
  )
}
