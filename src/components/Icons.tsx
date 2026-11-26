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

// ---- 작은 아이콘(버튼·목록·경고). 위 메뉴 아이콘과 같은 선 굵기로 통일한다 ----
// size: 크기(px). 글자 옆에 놓을 때는 className="icon"으로 글자 높이에 맞춘다

interface SmallIconProps {
  size?: number
}

function small(size = 18) {
  return { ...common, width: size, height: size, className: 'icon' }
}

/** 별(찜). filled면 칠한 별 */
export function StarIcon({ size, filled }: SmallIconProps & { filled?: boolean }) {
  return (
    <svg {...small(size)} fill={filled ? 'currentColor' : 'none'}>
      <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    </svg>
  )
}

/** 닫기·지우기(×) */
export function CloseIcon({ size }: SmallIconProps) {
  return (
    <svg {...small(size)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

/** 더 보기(가로 점 세 개) */
export function MoreIcon({ size }: SmallIconProps) {
  return (
    <svg {...small(size)}>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" />
    </svg>
  )
}

/** 체크(고른 항목 표시) */
export function CheckIcon({ size }: SmallIconProps) {
  return (
    <svg {...small(size)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}

/** 돋보기(검색) */
export function SearchIcon({ size }: SmallIconProps) {
  return (
    <svg {...small(size)}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

/** 더하기 */
export function PlusIcon({ size }: SmallIconProps) {
  return (
    <svg {...small(size)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/** 꺾쇠: 아래(펼쳐짐) */
export function ChevronDownIcon({ size }: SmallIconProps) {
  return (
    <svg {...small(size)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

/** 꺾쇠: 왼쪽(내 귀 균형 미세 조정) */
export function ChevronLeftIcon({ size }: SmallIconProps) {
  return (
    <svg {...small(size)}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  )
}

/** 꺾쇠: 오른쪽(접힘·다음 화면) */
export function ChevronRightIcon({ size }: SmallIconProps) {
  return (
    <svg {...small(size)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

/** 위로(맨 위로 가기) */
export function ArrowUpIcon({ size }: SmallIconProps) {
  return (
    <svg {...small(size)}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  )
}

/** 정보(도움말) */
export function InfoIcon({ size }: SmallIconProps) {
  return (
    <svg {...small(size)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  )
}

/** 경고(삼각형 느낌표) */
export function AlertIcon({ size }: SmallIconProps) {
  return (
    <svg {...small(size)}>
      <path d="M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
      <path d="M12 10v4M12 17h.01" />
    </svg>
  )
}

/** 보유(동그라미 안 체크). filled면 칠한 동그라미에 빈 체크 */
export function OwnedIcon({ size, filled }: SmallIconProps & { filled?: boolean }) {
  return (
    <svg {...small(size)}>
      <circle cx="12" cy="12" r="9" fill={filled ? 'currentColor' : 'none'} />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" stroke={filled ? 'var(--card)' : 'currentColor'} />
    </svg>
  )
}

/** 파일(파일 고르기 버튼) */
export function FileIcon({ size }: SmallIconProps) {
  return (
    <svg {...small(size)}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  )
}

/** 휴지통(지우기) */
export function TrashIcon({ size }: SmallIconProps) {
  return (
    <svg {...small(size)}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}
