// 동기화 합치기 규칙(순수 함수, 서버 종류를 모른다).
// - 같은 항목은 "나중에 고친 쪽(updatedAt이 큰 쪽)"이 이긴다. 시각이 같으면 서버
// - 지운 항목은 지우기 표시(Deletion)로 다른 기기에 알린다. 지운 뒤 다른 곳에서 다시 고쳤으면 고친 쪽이 살아남는다
// 실행(받기 → 합치기 → 올리기)은 syncRunner.ts
import type { Deletion } from './types'

/** 서버와 주고받는 단위 하나 */
export interface SyncDoc {
  id: string
  updatedAt: number
  /** 지운 항목 */
  deleted?: boolean
  /** 레코드 내용(지운 항목이면 없음) */
  data?: Record<string, unknown>
  /**
   * 서버가 받은 시각(ms, 서버 시계). 받을 때는 이것 기준으로 "지난번 뒤에 올라온 것"만 받는다.
   * 기기 시계(updatedAt)로 받으면 시계가 늦은 기기가 나중에 올린 변경을 놓칠 수 있어서
   */
  syncedAt?: number
}

export interface MergePlan {
  /** 로컬에 넣을(덮어쓸) 것 */
  putLocal: SyncDoc[]
  /** 로컬에서 지울 id */
  deleteLocal: string[]
  /** 서버에 올릴 것 */
  pushRemote: SyncDoc[]
}

/** 레코드의 고친 시각. 예전 데이터는 만든 시각, 그것도 없으면 0 */
export function recordUpdatedAt(r: { updatedAt?: number; createdAt?: number }): number {
  return r.updatedAt ?? r.createdAt ?? 0
}

/**
 * local: 로컬 레코드(지금 있는 것 전부), localDeletions: 로컬 지우기 표시,
 * remote: 서버에서 받은 것(마지막으로 받은 뒤 바뀐 것), lastPushedAt: 마지막으로 올린 시각(이전 것은 다시 올리지 않음)
 */
export function planMerge(local: SyncDoc[], localDeletions: Deletion[], remote: SyncDoc[], lastPushedAt: number): MergePlan {
  const localById = new Map(local.map((d) => [d.id, d]))
  const deletedAt = new Map(localDeletions.map((d) => [d.id, d.deletedAt]))
  const plan: MergePlan = { putLocal: [], deleteLocal: [], pushRemote: [] }
  const seen = new Set<string>()

  for (const r of remote) {
    seen.add(r.id)
    const l = localById.get(r.id)
    if (l) {
      if (l.updatedAt > r.updatedAt) plan.pushRemote.push(l)
      else if (r.deleted) plan.deleteLocal.push(r.id)
      else plan.putLocal.push(r)
      continue
    }
    if (r.deleted) continue
    const d = deletedAt.get(r.id)
    if (d !== undefined && d > r.updatedAt) plan.pushRemote.push({ id: r.id, updatedAt: d, deleted: true })
    else plan.putLocal.push(r)
  }

  for (const l of local) if (!seen.has(l.id) && l.updatedAt > lastPushedAt) plan.pushRemote.push(l)
  for (const d of localDeletions) {
    if (!seen.has(d.id) && !localById.has(d.id) && d.deletedAt > lastPushedAt) {
      plan.pushRemote.push({ id: d.id, updatedAt: d.deletedAt, deleted: true })
    }
  }
  return plan
}
