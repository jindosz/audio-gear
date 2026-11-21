// 동기화용 표시를 DB에 쓸 때 자동으로 붙인다(Dexie 훅: 테이블에 쓰기 직전에 Dexie가 부르는 함수).
// - 만들거나 고치면 updatedAt = 지금
// - 지우면 지우기 표시(deletions 테이블)를 남긴다 → 다음 동기화 때 다른 기기에서도 지워짐
// 화면·repo.ts의 함수 수십 곳을 하나하나 고치지 않고 여기 한 곳에서 처리한다.
// 서버에서 받아 넣는 쓰기(runAsRemote 안)는 손대지 않는다: 안 그러면 받은 걸 "방금 고친 것"으로 보고 다시 올려 끝없이 덮어씀
import type { Dexie, Table, Transaction } from 'dexie'
import { SYNC_TABLES, type Deletion, type SyncTable } from './types'

let remoteDepth = 0
const listeners = new Set<() => void>()

/** 이 안의 쓰기는 updatedAt·지우기 표시를 건드리지 않는다(서버에서 받은 것 넣기) */
export async function runAsRemote<T>(fn: () => Promise<T>): Promise<T> {
  remoteDepth++
  try {
    return await fn()
  } finally {
    remoteDepth--
  }
}

/** 로컬에서 동기화 대상이 바뀔 때마다 불림(자동 동기화가 30초 뒤에 맞추려고 씀). 돌려준 함수로 그만 받기 */
export function onLocalChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** 동기화 대상인지: 타깃은 내가 만든 것(isCustom)만 */
function syncable(table: SyncTable, obj: unknown): boolean {
  return table !== 'targets' || !!(obj as { isCustom?: boolean } | undefined)?.isCustom
}

/** 동기화 테이블 밖에서 바뀐 것(내 귀 설정 등)도 자동 동기화에 알린다 */
export function notifyLocalChange(): void {
  changed()
}

function changed() {
  // 훅 안에서 바로 부르면 아직 저장이 안 끝났을 수 있어 한 박자 뒤에
  setTimeout(() => listeners.forEach((l) => l()), 0)
}

/** db.ts가 한 번 부른다 */
export function installSyncStamp(db: Dexie & { deletions: Table<Deletion, [string, string]> }): void {
  for (const table of SYNC_TABLES) {
    const t = db.table(table)
    t.hook('creating', (_key, obj) => {
      if (remoteDepth > 0 || !syncable(table, obj)) return
      ;(obj as { updatedAt?: number }).updatedAt = Date.now()
      changed()
    })
    t.hook('updating', (_mods, _key, obj) => {
      if (remoteDepth > 0 || !syncable(table, obj)) return undefined
      changed()
      return { updatedAt: Date.now() }
    })
    t.hook('deleting', (key, obj, tx: Transaction) => {
      if (remoteDepth > 0 || !syncable(table, obj)) return
      const record: Deletion = { table, id: String(key), deletedAt: Date.now() }
      // 지우기가 실제로 끝난 뒤에 표시를 남긴다(중간에 실패하면 안 남김)
      tx.on('complete', () => {
        void db.deletions.put(record)
        changed()
      })
    })
  }
}
