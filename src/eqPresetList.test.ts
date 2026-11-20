// eqPresetList.ts 테스트(같은 조합 찾기, EQ 목록 묶기·정렬·검색). 실행: npm test
import { describe, expect, it } from 'vitest'
import { findSamePreset, groupPresets } from './eqPresetList'
import type { EqPreset } from './types'

const preset = (id: string, patch: Partial<EqPreset> = {}): EqPreset => ({
  id,
  name: id,
  measurementId: 'm-hd600',
  goal: '',
  filters: [],
  createdAt: 0,
  updatedAt: 0,
  ...patch,
})

describe('findSamePreset: 같은 "지금 기기 → 목표" 조합', () => {
  const list = [preset('a', { goal: 'm:hd650' }), preset('b', { goal: 't:harman' }), preset('c', { goal: '' })]

  it('기기와 목표가 같은 EQ를 찾는다', () => {
    expect(findSamePreset(list, 'm-hd600', 'm:hd650')?.id).toBe('a')
  })

  it('목표가 다르거나 기기가 다르면 없음', () => {
    expect(findSamePreset(list, 'm-hd600', 'm:other')).toBeUndefined()
    expect(findSamePreset(list, 'm-other', 'm:hd650')).toBeUndefined()
  })

  it('목표가 없는(직접 조정) EQ는 같은 조합으로 보지 않는다', () => {
    expect(findSamePreset(list, 'm-hd600', '')).toBeUndefined()
  })

  it('자기 자신은 빼고 찾을 수 있다', () => {
    expect(findSamePreset(list, 'm-hd600', 'm:hd650', 'a')).toBeUndefined()
  })
})

describe('groupPresets: 즐겨찾기 → 기기별 묶음, 묶음 안은 최근 수정 순', () => {
  const deviceName = (measurementId: string) => (measurementId === 'm-hd600' ? 'Sennheiser HD 600' : 'Denon AH-D600')
  const list = [
    preset('old600', { name: 'HD600 → Harman', updatedAt: 1 }),
    preset('new600', { name: 'HD600 → HD650', updatedAt: 5 }),
    preset('d600', { name: 'D600 → HD650', measurementId: 'm-d600', updatedAt: 9 }),
    preset('fav', { name: '즐겨 쓰는 EQ', updatedAt: 0, favorite: true }),
  ]

  it('즐겨찾기 묶음이 맨 위, 기기 묶음은 가장 최근에 고친 EQ가 있는 기기부터', () => {
    const groups = groupPresets(list, deviceName, '')
    expect(groups.map((g) => g.title)).toEqual(['즐겨찾기', 'Denon AH-D600', 'Sennheiser HD 600'])
    expect(groups[0].items.map((p) => p.id)).toEqual(['fav'])
    expect(groups[2].items.map((p) => p.id)).toEqual(['new600', 'old600'])
  })

  it('검색어는 EQ 이름과 기기 이름에서 찾는다(공백·대소문자 무시)', () => {
    expect(groupPresets(list, deviceName, 'harman').flatMap((g) => g.items.map((p) => p.id))).toEqual(['old600'])
    expect(groupPresets(list, deviceName, 'denon').flatMap((g) => g.items.map((p) => p.id))).toEqual(['d600'])
    expect(groupPresets(list, deviceName, 'hd 650').flatMap((g) => g.items.map((p) => p.id))).toEqual(['d600', 'new600'])
  })

  it('맞는 EQ가 없으면 빈 목록', () => {
    expect(groupPresets(list, deviceName, 'xyz')).toEqual([])
  })
})
