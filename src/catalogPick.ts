// EQ 화면의 "다른 기기 찾기"용 계산(순수 함수): 전체 기기 목록에서 검색하고, 받을 측정치를 고른다
import { catalogSourceLabel, entryFor, normalize, type CatalogDevice, type CatalogEntry } from './catalog'
import type { DeviceCategory } from './types'

/**
 * 띄어쓰기로 나눈 검색어가 모두 이름에 들어 있는 기기를 찾는다.
 * - 측정치를 받을 수 없는 기기(곡선 비공개)는 뺀다
 * - preferCategory(지금 기기 종류)와 같은 종류를 먼저, 그 안에서는 원래 순서(이름순)
 */
export function searchCatalogDevices(
  devices: CatalogDevice[],
  query: string,
  preferCategory: DeviceCategory | null,
  limit = 30,
): CatalogDevice[] {
  const words = query.split(/\s+/).map(normalize).filter(Boolean)
  if (words.length === 0) return []
  const found = devices.filter((d) => d.curves.length > 0 && words.every((w) => d.searchKey.includes(w)))
  // 순위: 단어 앞부분이 맞는 기기("hd 600" → Sennheiser HD 600, Denon AH-D600은 뒤로) → 같은 종류 → 이름순
  const rank = (d: CatalogDevice) =>
    (words.every((w) => startsAtWord(d.name, w)) ? 0 : 2) + (d.category === preferCategory ? 0 : 1)
  // sort는 순위가 같으면 원래 순서(이름순)를 지킨다
  return found
    .map((d) => ({ d, r: rank(d) }))
    .sort((a, b) => a.r - b.r)
    .slice(0, limit)
    .map(({ d }) => d)
}

/** 검색어(normalize한 것)가 이름의 어떤 단어 앞에서부터 맞는지. 띄어쓰기를 건너뛰어도 된다("hd600" ↔ "HD 600") */
function startsAtWord(name: string, word: string): boolean {
  const tokens = name.split(/[\s\-_/()]+/).map(normalize).filter(Boolean)
  return tokens.some((_, i) => tokens.slice(i).join('').startsWith(word))
}

/**
 * 고른 기기에서 받을 측정치. 맞출 측정자(preferredSource, 예: "AutoEQ · oratory1990")가
 * 이 기기를 쟀으면 그 측정치를, 아니면 기본 측정치(AutoEQ 추천 우선)를 고른다.
 * 측정자가 다르면 측정 환경 차이까지 EQ에 섞이기 때문에 같은 측정자를 우선한다
 */
export function pickCatalogEntry(device: CatalogDevice, preferredSource: string | null): CatalogEntry | undefined {
  if (preferredSource && device.measurers.has(preferredSource)) return entryFor(device, preferredSource)
  return device.primary ?? device.curves[0]
}

/** 고른 측정치가 맞출 측정자와 같은지(화면에 "같은 측정자" 표시용) */
export function isSameSource(entry: CatalogEntry, preferredSource: string | null): boolean {
  return preferredSource !== null && catalogSourceLabel(entry) === preferredSource
}
