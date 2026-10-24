// 기기 목록 필터(브랜드, 유선/무선, 오픈/밀폐, ANC). 순수 함수.
// 특징은 입력값이 있으면 입력값, 없으면 이름으로 추정한 값(specHints.ts)으로 판단한다.
// 특징 필터를 켜면 특징을 모르는 기기는 빠진다(추정 규칙이 없는 이어폰 대부분이 여기에 해당).
import { hasSpecs, type Specs } from './labels'
import { splitBrand } from './nameClean'
import { specHint } from './specHints'
import { normalize } from './text'
import type { DeviceCategory } from './types'

export interface ListFilter {
  /** 브랜드(normalize한 값). null이면 모든 브랜드 */
  brand: string | null
  connection: 'wired' | 'wireless' | null
  /** open은 세미 오픈도 포함 */
  acoustic: 'open' | 'closed' | null
  anc: boolean
}

export const EMPTY_FILTER: ListFilter = { brand: null, connection: null, acoustic: null, anc: false }

/** 켜진 필터 개수(버튼에 숫자로 표시) */
export function activeCount(f: ListFilter): number {
  return [f.brand, f.connection, f.acoustic, f.anc || null].filter((v) => v !== null).length
}

/** 목록 한 줄을 거르는 데 필요한 정보 */
export interface FilterInfo {
  brandKey: string
  specs: Specs | undefined
}

/** 이름(+입력해 둔 특징)으로 필터 정보를 만든다 */
export function filterInfo(name: string, category: DeviceCategory, stored?: Specs): FilterInfo {
  return {
    brandKey: normalize(splitBrand(name).brand),
    specs: stored && hasSpecs(stored) ? stored : specHint(name, category),
  }
}

export function matchesFilter(info: FilterInfo, f: ListFilter): boolean {
  if (f.brand && info.brandKey !== f.brand) return false
  const s = info.specs
  if (f.connection) {
    // 유·무선 겸용(both)은 둘 다에 걸린다
    if (!s?.connection) return false
    if (s.connection !== 'both' && s.connection !== f.connection) return false
  }
  if (f.acoustic) {
    if (!s?.acoustic) return false
    if (f.acoustic === 'closed' ? s.acoustic !== 'closed' : s.acoustic === 'closed') return false
  }
  if (f.anc && !s?.anc) return false
  return true
}

/** 브랜드 선택지: 이름(처음 본 표기)과 기기 수, 이름순 */
export function brandOptions(names: string[]): { key: string; label: string; count: number }[] {
  const byKey = new Map<string, { key: string; label: string; count: number }>()
  for (const name of names) {
    const brand = splitBrand(name).brand
    const key = normalize(brand)
    if (!key) continue
    const item = byKey.get(key)
    if (item) item.count++
    else byKey.set(key, { key, label: brand, count: 1 })
  }
  const collator = new Intl.Collator('en', { sensitivity: 'base' })
  return [...byKey.values()].sort((a, b) => collator.compare(a.label, b.label))
}
