// 앱에서 다루는 데이터의 모양(타입)을 한곳에 모아 둔 파일.

/** 주파수 응답(FR) 곡선: 주파수(Hz)마다 음압(dB) 하나 */
export type FrCurve = { freq: number; db: number }[]

export type DeviceCategory = 'headphone' | 'iem'

/** 측정 장비(리그). 리그가 다르면 같은 기기도 곡선이 달라진다 */
export type Rig = '5128' | '711' | 'gras' | 'other'

export type Channel = 'L' | 'R' | 'avg'

/** 기기 하나 */
export interface Device {
  id: string
  brand: string
  model: string
  category: DeviceCategory
  owned: boolean
  /** 찜(관심 기기). 이 필드가 생기기 전에 저장된 기기에는 없을 수 있어서 선택(?) 필드 */
  wishlist?: boolean
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
  createdAt: number
}
