// catalog.ts 테스트(목록 묶기, 측정자별 측정치 고르기). 실행: npm test
import { describe, expect, it } from 'vitest'
import { catalogSourceLabel, entryFor, groupCatalog, type CatalogEntry } from './catalog'

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

describe('측정자 표기', () => {
  it('측정치 source와 같은 형식으로 만든다', () => {
    expect(catalogSourceLabel(entry({ provider: 'autoeq', source: 'oratory1990' }))).toBe('AutoEQ · oratory1990')
    expect(catalogSourceLabel(entry({ provider: 'squig', source: 'Banbeucmas' }))).toBe('squig.link · Banbeucmas')
  })
})

describe('groupCatalog의 측정자 목록', () => {
  it('받을 수 있는 측정치의 측정자만 모은다(crinacle처럼 곡선이 없는 것은 뺌)', () => {
    const [device] = groupCatalog([
      entry({ source: 'oratory1990', path: 'a', recommended: true }),
      entry({ source: 'Rtings', path: 'b' }),
      entry({ source: 'crinacle', path: 'c', hasCurve: false }),
      entry({ provider: 'squig', source: 'Banbeucmas', name: 'Sennheiser HD600', path: 'd' }),
    ])
    expect([...device.measurers].sort()).toEqual(['AutoEQ · Rtings', 'AutoEQ · oratory1990', 'squig.link · Banbeucmas'])
  })
})

describe('entryFor: 클릭했을 때 받을 측정치', () => {
  const [device] = groupCatalog([
    entry({ source: 'Rtings', path: 'b' }),
    entry({ source: 'oratory1990', path: 'a', recommended: true }),
    entry({ provider: 'squig', source: 'Banbeucmas', path: 'd' }),
  ])

  it('측정자를 고르지 않았으면 추천 측정치', () => {
    expect(entryFor(device, null)?.path).toBe('a')
  })

  it('측정자를 골랐으면 그 측정자의 측정치', () => {
    expect(entryFor(device, 'AutoEQ · Rtings')?.path).toBe('b')
    expect(entryFor(device, 'squig.link · Banbeucmas')?.path).toBe('d')
  })

  it('그 측정자의 측정치가 없으면 undefined', () => {
    expect(entryFor(device, 'AutoEQ · crinacle')).toBeUndefined()
  })
})
