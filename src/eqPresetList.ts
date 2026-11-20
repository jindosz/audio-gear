// 저장한 EQ 목록 다루기(순수 함수): 같은 조합 찾기(중복 방지), 즐겨찾기·기기별 묶기, 검색.
import { normalize } from './text'
import type { EqPreset } from './types'

/**
 * "지금 쓰는 기기 → 목표"가 같은 EQ. 같은 조합을 또 만들지 않게 쓴다.
 * 목표가 없는(직접 조정한) EQ는 조합이 없으니 찾지 않는다. exceptId: 이 EQ는 빼고 찾기(자기 자신)
 */
export function findSamePreset(
  presets: EqPreset[],
  measurementId: string,
  goal: string,
  exceptId?: string,
): EqPreset | undefined {
  if (!goal || !measurementId) return undefined
  return presets.find((p) => p.id !== exceptId && p.measurementId === measurementId && p.goal === goal)
}

export interface PresetGroup {
  /** 화면 key */
  key: string
  /** 묶음 제목: "즐겨찾기" 또는 지금 쓰는 기기 이름 */
  title: string
  items: EqPreset[]
}

const byRecent = (a: EqPreset, b: EqPreset) => b.updatedAt - a.updatedAt

/**
 * 목록 화면용으로 묶는다: 즐겨찾기(맨 위) → 지금 쓰는 기기별(가장 최근에 고친 EQ가 있는 기기부터).
 * 묶음 안은 최근 수정 순. 즐겨찾기한 EQ는 기기 묶음에 다시 넣지 않는다.
 * query: EQ 이름·기기 이름에서 찾는다(공백·기호·대소문자 무시)
 */
export function groupPresets(
  presets: EqPreset[],
  deviceNameOf: (measurementId: string) => string,
  query: string,
): PresetGroup[] {
  const words = query.split(/\s+/).map(normalize).filter(Boolean)
  const key = (p: EqPreset) => normalize(`${p.name} ${deviceNameOf(p.measurementId)}`)
  // 검색어를 띄어 써도("hd 650") 붙여 쓴 이름("HD650")과 맞게, 단어별로도 보고 전체를 붙여서도 본다
  const joined = normalize(query)
  const matches = (p: EqPreset) => !joined || words.every((w) => key(p).includes(w)) || key(p).includes(joined)
  const shown = presets.filter(matches)

  const groups: PresetGroup[] = []
  const favorites = shown.filter((p) => p.favorite).sort(byRecent)
  if (favorites.length) groups.push({ key: 'favorites', title: '즐겨찾기', items: favorites })

  const byDevice = new Map<string, EqPreset[]>()
  for (const p of shown) {
    if (p.favorite) continue
    const name = deviceNameOf(p.measurementId)
    byDevice.set(name, [...(byDevice.get(name) ?? []), p])
  }
  const deviceGroups = [...byDevice.entries()].map(([title, items]) => ({
    key: `device:${title}`,
    title,
    items: items.sort(byRecent),
  }))
  deviceGroups.sort((a, b) => b.items[0].updatedAt - a.items[0].updatedAt)
  return [...groups, ...deviceGroups]
}
