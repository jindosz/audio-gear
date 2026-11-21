// sync.ts 테스트(동기화 합치기 규칙). 실행: npm test
import { describe, expect, it } from 'vitest'
import { planMerge, recordUpdatedAt, type SyncDoc } from './sync'
import type { Deletion } from './types'

const doc = (id: string, updatedAt: number, extra: Partial<SyncDoc> = {}): SyncDoc => ({ id, updatedAt, data: { id }, ...extra })
const del = (id: string, deletedAt: number): Deletion => ({ table: 'devices', id, deletedAt })

describe('planMerge', () => {
  it('서버에만 있는 것 → 로컬에 넣기', () => {
    const p = planMerge([], [], [doc('a', 10)], 0)
    expect(p.putLocal.map((d) => d.id)).toEqual(['a'])
    expect(p.pushRemote).toEqual([])
  })
  it('로컬에만 있고 마지막으로 올린 뒤에 고친 것 → 올리기', () => {
    const p = planMerge([doc('a', 10)], [], [], 5)
    expect(p.pushRemote.map((d) => d.id)).toEqual(['a'])
  })
  it('마지막으로 올리기 전에 고친 로컬은 다시 올리지 않음', () => {
    expect(planMerge([doc('a', 3)], [], [], 5).pushRemote).toEqual([])
  })
  it('같은 id, 로컬이 더 새것 → 올리기만', () => {
    const p = planMerge([doc('a', 20)], [], [doc('a', 10)], 0)
    expect(p.pushRemote.map((d) => d.updatedAt)).toEqual([20])
    expect(p.putLocal).toEqual([])
  })
  it('같은 id, 서버가 더 새것 → 로컬에 넣기', () => {
    const p = planMerge([doc('a', 10)], [], [doc('a', 20)], 0)
    expect(p.putLocal.map((d) => d.updatedAt)).toEqual([20])
    expect(p.pushRemote).toEqual([])
  })
  it('시각이 같으면 서버가 이김', () => {
    const p = planMerge([doc('a', 10)], [], [doc('a', 10)], 0)
    expect(p.putLocal.map((d) => d.id)).toEqual(['a'])
    expect(p.pushRemote).toEqual([])
  })
  it('서버가 지웠으면 로컬에서도 지우기', () => {
    const p = planMerge([doc('a', 10)], [], [doc('a', 20, { deleted: true, data: undefined })], 0)
    expect(p.deleteLocal).toEqual(['a'])
  })
  it('서버가 지운 뒤 로컬에서 다시 고쳤으면 로컬이 살아남아 올라감', () => {
    const p = planMerge([doc('a', 30)], [], [doc('a', 20, { deleted: true, data: undefined })], 0)
    expect(p.deleteLocal).toEqual([])
    expect(p.pushRemote.map((d) => d.id)).toEqual(['a'])
  })
  it('로컬에서 지운 게 서버 수정보다 늦으면 서버에 지움으로 올리기', () => {
    const p = planMerge([], [del('a', 30)], [doc('a', 20)], 0)
    expect(p.putLocal).toEqual([])
    expect(p.pushRemote).toEqual([{ id: 'a', updatedAt: 30, deleted: true }])
  })
  it('로컬에서 지운 뒤 서버(다른 기기)에서 고쳤으면 서버 것이 살아남음', () => {
    const p = planMerge([], [del('a', 10)], [doc('a', 20)], 0)
    expect(p.putLocal.map((d) => d.id)).toEqual(['a'])
    expect(p.pushRemote).toEqual([])
  })
  it('서버에 없는 로컬 지우기 표시는 새것만 올림', () => {
    expect(planMerge([], [del('a', 30)], [], 10).pushRemote).toEqual([{ id: 'a', updatedAt: 30, deleted: true }])
    expect(planMerge([], [del('a', 5)], [], 10).pushRemote).toEqual([])
  })
})

describe('recordUpdatedAt', () => {
  it('updatedAt → createdAt → 0', () => {
    expect(recordUpdatedAt({ updatedAt: 7, createdAt: 5 })).toBe(7)
    expect(recordUpdatedAt({ createdAt: 5 })).toBe(5)
    expect(recordUpdatedAt({})).toBe(0)
  })
})
