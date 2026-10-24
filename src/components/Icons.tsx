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

export function SettingsIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
    </svg>
  )
}
