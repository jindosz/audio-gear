// backup.ts 테스트(백업 파일 검사). 실행: npm test
import { describe, expect, it } from 'vitest'
import { BACKUP_APP, parseBackup } from './backup'

const base = { app: BACKUP_APP, version: 1, exportedAt: '', devices: [], measurements: [], targets: [], tabs: [] }
const ear = {
  balance: { db: 1.5, on: true, measuredAt: '2026-11-21T00:00:00Z' },
  profile: {
    measuredAt: '2026-11-21T00:00:00Z',
    device: null,
    left: { freqs: [1000], thresholds: [-50], atLimit: [false], recheck: -50, falseAlarms: 0 },
    right: { freqs: [1000], thresholds: [-48], atLimit: [false], recheck: null, falseAlarms: 1 },
    offset: null,
    strength: 0.5,
    on: true,
  },
}

describe('parseBackup: 내 귀 설정', () => {
  it('없으면 ear 없음(예전 백업)', () => {
    expect(parseBackup(JSON.stringify(base)).ear).toBeUndefined()
  })
  it('균형·보정이 있으면 그대로 읽음', () => {
    const data = parseBackup(JSON.stringify({ ...base, ear }))
    expect(data.ear?.balance?.db).toBe(1.5)
    expect(data.ear?.profile?.right.thresholds).toEqual([-48])
  })
  it('하나만 있어도 됨', () => {
    const data = parseBackup(JSON.stringify({ ...base, ear: { balance: null, profile: ear.profile } }))
    expect(data.ear?.balance).toBeNull()
    expect(data.ear?.profile).not.toBeNull()
  })
  it('모양이 틀린 내 귀 설정은 버리고 나머지는 가져옴', () => {
    const data = parseBackup(JSON.stringify({ ...base, ear: { balance: { db: 'x' }, profile: { left: 1 } } }))
    expect(data.ear).toBeUndefined()
    expect(data.devices).toEqual([])
  })
})
