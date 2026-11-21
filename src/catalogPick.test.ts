// catalogPick.ts 테스트(EQ 화면의 다른 기기 찾기). 실행: npm test
import { describe, expect, it } from 'vitest'
import { groupCatalog, type CatalogEntry } from './catalog'
import { isSameSource, pickCatalogEntry, searchCatalogDevices } from './catalogPick'

const entry = (patch: Partial<CatalogEntry>): CatalogEntry => ({
  provider: 'autoeq',
  name: 'Sennheiser HD 600',
  source: 'oratory1990',
  rigName: '',
  rig: 'gras',
  category: 'headphone',
  path: 'p',
  hasCurve: true,
  recommended: false,
  ...patch,
})

const devices = groupCatalog([
  entry({ name: 'Sennheiser HD 600', path: 'a', recommended: true }),
  entry({ name: 'Sennheiser HD 600', path: 'b', source: 'Rtings', rig: '5128' }),
  entry({ name: 'Sennheiser HD 650', path: 'c' }),
  entry({ name: 'Sennheiser IE 600', path: 'd', category: 'iem' }),
  entry({ name: 'Sennheiser HD 25', path: 'e', source: 'crinacle', hasCurve: false }),
  entry({ name: 'Denon AH-D600', path: 'f' }),
])

describe('searchCatalogDevices', () => {
  it('검색어가 없으면 아무것도 안 보여준다', () => {
    expect(searchCatalogDevices(devices, '  ', 'headphone')).toEqual([])
  })

  it('띄어쓰기·기호를 무시하고 모든 단어가 들어간 기기를 찾는다', () => {
    expect(searchCatalogDevices(devices, 'hd650', null).map((d) => d.name)).toEqual(['Sennheiser HD 650'])
    expect(searchCatalogDevices(devices, 'senn 600', null).map((d) => d.name)).toEqual([
      'Sennheiser HD 600',
      'Sennheiser IE 600',
    ])
  })

  it('측정치를 받을 수 없는 기기는 뺀다', () => {
    expect(searchCatalogDevices(devices, 'hd 25', null)).toEqual([])
  })

  it('지금 기기와 같은 종류를 먼저 보여준다', () => {
    expect(searchCatalogDevices(devices, '600', 'iem').map((d) => d.name)).toEqual([
      'Sennheiser IE 600',
      'Sennheiser HD 600',
      'Denon AH-D600',
    ])
  })

  it('단어 앞부분이 맞는 기기를 먼저 보여준다', () => {
    expect(searchCatalogDevices(devices, 'hd 600', 'headphone').map((d) => d.name)).toEqual([
      'Sennheiser HD 600',
      'Denon AH-D600',
    ])
  })

  it('개수를 제한한다', () => {
    expect(searchCatalogDevices(devices, 'sennheiser', null, 2)).toHaveLength(2)
  })
})

describe('pickCatalogEntry', () => {
  const hd600 = devices.find((d) => d.name === 'Sennheiser HD 600')!

  it('맞출 측정자가 잰 측정치가 있으면 그것을 고른다', () => {
    const picked = pickCatalogEntry(hd600, 'AutoEQ · Rtings')!
    expect(picked.path).toBe('b')
    expect(isSameSource(picked, 'AutoEQ · Rtings')).toBe(true)
  })

  it('없으면 기본(추천) 측정치를 고른다', () => {
    const picked = pickCatalogEntry(hd600, 'squig.link · 어딘가')!
    expect(picked.path).toBe('a')
    expect(isSameSource(picked, 'squig.link · 어딘가')).toBe(false)
  })

  it('맞출 측정자가 없어도 기본 측정치를 고른다', () => {
    expect(pickCatalogEntry(hd600, null)!.path).toBe('a')
  })
})
