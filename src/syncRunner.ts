// 동기화 한 번 실행: 테이블마다 서버에서 바뀐 것 받기 → 합치기(sync.ts) → 로컬에 반영 → 서버에 올리기.
// 서버 종류는 모른다(syncBackend.ts). 진행 상태(마지막으로 받은·올린 시각)는 끝까지 성공했을 때만 저장해서,
// 중간에 앱을 닫거나 인터넷이 끊겨도 다음 번에 그 자리부터 다시 맞춘다.
import Dexie from 'dexie'
import { db } from './db'
import { readPref, writePref } from './localPrefs'
import { planMerge, recordUpdatedAt, type SyncDoc } from './sync'
import type { SyncBackend } from './syncBackend'
import { runAsRemote } from './syncStamp'
import { SYNC_TABLES, type SyncTable } from './types'

interface SyncState {
  /** 서버 시계 기준, 마지막으로 받은 문서의 syncedAt */
  lastPulledAt: number
  /** 기기 시계 기준, 마지막 동기화를 시작한 시각(이보다 나중에 고친 것만 올림) */
  lastPushedAt: number
}

/** 올린 지우기 표시는 이만큼 지나면 정리(다른 기기들이 그 사이에 한 번은 동기화했다고 봄) */
const DELETION_KEEP_MS = 30 * 24 * 60 * 60 * 1000

const stateKey = (uid: string) => `sync.state.${uid}`
export const readSyncState = (uid: string) => readPref<SyncState>(stateKey(uid), { lastPulledAt: 0, lastPushedAt: 0 })

type AnyRecord = { id: string; updatedAt?: number; createdAt?: number; isCustom?: boolean }

/** 이 테이블에서 동기화할 레코드(타깃은 내가 만든 것만) */
async function localRecords(table: SyncTable): Promise<AnyRecord[]> {
  const all = (await db.table(table).toArray()) as AnyRecord[]
  return table === 'targets' ? all.filter((t) => t.isCustom) : all
}

async function syncTable(backend: SyncBackend, uid: string, table: SyncTable, state: SyncState, startedAt: number) {
  const remote = await backend.pullSince(uid, table, state.lastPulledAt)
  const records = await localRecords(table)
  const local: SyncDoc[] = records.map((r) => ({ id: r.id, updatedAt: recordUpdatedAt(r), data: r }))
  const deletions = await db.deletions.where('[table+id]').between([table, Dexie.minKey], [table, Dexie.maxKey]).toArray()
  const plan = planMerge(local, deletions, remote, state.lastPushedAt)

  // 받은 것 넣기(훅이 고친 시각·지우기 표시를 건드리지 않게 runAsRemote 안에서)
  await runAsRemote(() =>
    db.transaction('rw', db.table(table), db.deletions, async () => {
      if (plan.putLocal.length) {
        // 고친 시각은 이번 동기화 시작 시각을 넘지 않게: 시계가 빠른 기기의 값을 그대로 두면
        // 다음 동기화 때 "방금 고친 것"으로 보여 매번 다시 올리게 된다
        await db
          .table(table)
          .bulkPut(plan.putLocal.map((d) => ({ ...d.data, id: d.id, updatedAt: Math.min(d.updatedAt, startedAt) })))
        // 다른 기기에서 다시 고쳐 살아난 항목은 지우기 표시를 없앤다
        await db.deletions.bulkDelete(plan.putLocal.map((d) => [table, d.id] as [string, string]))
      }
      if (plan.deleteLocal.length) await db.table(table).bulkDelete(plan.deleteLocal)
    }),
  )
  if (plan.pushRemote.length) await backend.push(uid, table, plan.pushRemote)

  const newest = Math.max(0, ...remote.map((d) => d.syncedAt ?? 0))
  return { pulled: plan.putLocal.length + plan.deleteLocal.length, pushed: plan.pushRemote.length, newest }
}

/** 동기화 한 번. 성공하면 받은·올린 개수 */
export async function runSync(backend: SyncBackend, uid: string): Promise<{ pulled: number; pushed: number }> {
  const state = readSyncState(uid)
  const startedAt = Date.now()
  let pulled = 0
  let pushed = 0
  let newest = state.lastPulledAt
  for (const table of SYNC_TABLES) {
    const r = await syncTable(backend, uid, table, state, startedAt)
    pulled += r.pulled
    pushed += r.pushed
    newest = Math.max(newest, r.newest)
  }
  writePref(stateKey(uid), { lastPulledAt: newest, lastPushedAt: startedAt } satisfies SyncState)
  // 올린 지 오래된 지우기 표시 정리
  await db.deletions.where('deletedAt').below(startedAt - DELETION_KEEP_MS).delete()
  return { pulled, pushed }
}

/** 이 기기에 동기화할 내 데이터가 있는지(다른 계정으로 로그인할 때 합칠지 물어보려고) */
export async function hasLocalData(): Promise<boolean> {
  for (const table of SYNC_TABLES) if ((await localRecords(table)).length) return true
  return false
}
