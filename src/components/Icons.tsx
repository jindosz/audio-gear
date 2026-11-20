// 왼쪽 메뉴에 쓰는 간단한 선 아이콘. currentColor라서 글자색을 따라간다
const common = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function HeadphoneIcon() {
  return (
    <svg {...common}>
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="5" height="7" rx="1.5" />
      <rect x="16" y="14" width="5" height="7" rx="1.5" />
    </svg>
  )
}

export function EarphoneIcon() {
  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="4" />
      <path d="M10.5 11 13 20" />
      <circle cx="17" cy="6" r="3" />
      <path d="M18.5 8.5 20 16" />
    </svg>
  )
}

/** 그래프: 축과 꺾은선(폰에서 기기·그래프 화면으로 돌아가는 버튼) */
export function GraphIcon() {
  return (
    <svg {...common}>
      <path d="M4 4v16h16" />
      <path d="M7 15l4-5 3 3 5-6" />
    </svg>
  )
}

/** EQ: 높이가 다른 슬라이더 세 개 */
export function EqIcon() {
  return (
    <svg {...common}>
      <path d="M6 4v16M12 4v16M18 4v16" />
      <circle cx="6" cy="14" r="2" fill="var(--bg)" />
      <circle cx="12" cy="8" r="2" fill="var(--bg)" />
      <circle cx="18" cy="16" r="2" fill="var(--bg)" />
    </svg>
  )
}

/** 설정: 톱니바퀴 */
export function SettingsIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

/** 해: 라이트 모드로 바꾸는 버튼 */
export function SunIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

/** 달: 다크 모드로 바꾸는 버튼 */
export function MoonIcon() {
  return (
    <svg {...common}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}
