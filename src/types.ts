// 앱에서 다루는 데이터의 모양(타입)을 한곳에 모아 둔 파일.

/** 주파수 응답(FR) 곡선: 주파수(Hz)마다 음압(dB) 하나 */
export type FrCurve = { freq: number; db: number }[]

export type DeviceCategory = 'headphone' | 'iem'

/** 측정 장비(리그). 리그가 다르면 같은 기기도 곡선이 달라진다 */
export type Rig = '5128' | '711' | 'gras' | 'other'

export type Channel = 'L' | 'R' | 'avg'

/** 연결 방식. both는 유선·무선 둘 다 되는 기기(블루투스 헤드폰에 케이블 단자가 있는 경우 등) */
export type Connection = 'wired' | 'wireless' | 'both'

/** 하우징 구조: 오픈형 / 세미 오픈형 / 밀폐형 */
export type Acoustic = 'open' | 'semi-open' | 'closed'

/** 블루투스 코덱 */
export type Codec = 'SBC' | 'AAC' | 'aptX' | 'aptX HD' | 'aptX Adaptive' | 'aptX Lossless' | 'LDAC' | 'LHDC' | 'LC3'

/** 기기 하나 */
export interface Device {
  id: string
  brand: string
  model: string
  category: DeviceCategory
  owned: boolean
  /** 찜(관심 기기). 이 필드가 생기기 전에 저장된 기기에는 없을 수 있어서 선택(?) 필드 */
  wishlist?: boolean
  // ---- 주요 특징. AutoEQ 목록에는 이런 정보가 없어서 사용자가 직접 입력한다(모르면 비워 둠) ----
  connection?: Connection
  acoustic?: Acoustic
  /** 지원 코덱. 무선(또는 유·무선)일 때만 의미가 있다 */
  codecs?: Codec[]
  /** 노이즈 캔슬링(ANC) 지원 여부 */
  anc?: boolean
  notes: string
  createdAt: number
}

/** 기기 하나에 대한 측정치 하나. 구성(variant)별로 여러 개가 있을 수 있다 */
export interface Measurement {
  id: string
  deviceId: string
  /** 이어팁·패드 등 구성. 예: "기본 팁", "벨루어 패드" */
  variant: string
  rig: Rig
  /** 'local'(직접 업로드) 또는 출처 이름 */
  source: string
  channel: Channel
  curve: FrCurve
}

/** 타깃 커브(Harman OE/IE 등) */
export interface Target {
  id: string
  name: string
  category: DeviceCategory
  rig: Rig
  isCustom: boolean
  curve: FrCurve
}

/** 앱이 보관하는 값 하나(예: 내려받은 AutoEQ 목록 원문) */
export interface MetaRecord {
  key: string
  value: string
  updatedAt: number
}

/** 비교 탭에서 고른 측정치 하나와 그 색 순번 */
export interface CompareSelection {
  measurementId: string
  colorIndex: number
}

/** 비교 탭 하나 */
export interface CompareTab {
  id: string
  name: string
  selections: CompareSelection[]
  /** 정규화 기준 주파수(Hz). null이면 정규화하지 않음 */
  normalizeHz: number | null
  targetId: string | null
  /**
   * 차이 곡선의 기준: 'target'(타깃) 또는 측정치 id. null이면 차이 곡선을 그리지 않는다.
   * 이 필드가 생기기 전에 만든 탭에는 없을 수 있어서 선택(?) 필드
   */
  diffRef?: string | null
  createdAt: number
}
