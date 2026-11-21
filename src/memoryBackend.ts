// 시험용 가짜 서버(메모리 안). 테스트와 개발 서버의 ?sync=memory 화면 확인에만 쓴다.
import type { SyncDoc } from './sync'
import type { SyncBackend, SyncCollection, SyncUser } from './syncBackend'

interface Server {
  /** 서버 시계(올릴 때마다 1씩, 실제 시각 대신) */
  clock: number
  users: Map<string, { password: string; uid: string }>
  /** uid → 묶음 → id → 문서 */
  data: Map<string, Map<SyncCollection, Map<string, SyncDoc>>>
}

const authError = (code: string) => Object.assign(new Error(code), { code })

export function createMemoryBackend(server: Server = { clock: 0, users: new Map(), data: new Map() }): SyncBackend {
  let user: SyncUser | null = null
  const listeners = new Set<(u: SyncUser | null) => void>()
  const setUser = (u: SyncUser | null) => {
    user = u
    listeners.forEach((l) => l(u))
  }
  const box = (uid: string, c: SyncCollection) => {
    let byUser = server.data.get(uid)
    if (!byUser) server.data.set(uid, (byUser = new Map()))
    let byCol = byUser.get(c)
    if (!byCol) byUser.set(c, (byCol = new Map()))
    return byCol
  }
  return {
    onUser(cb) {
      listeners.add(cb)
      cb(user)
      return () => listeners.delete(cb)
    },
    async signIn(email, password) {
      const u = server.users.get(email)
      if (!u || u.password !== password) throw authError('auth/invalid-credential')
      setUser({ uid: u.uid, email })
    },
    async signUp(email, password) {
      if (server.users.has(email)) throw authError('auth/email-already-in-use')
      if (password.length < 6) throw authError('auth/weak-password')
      const uid = `uid-${server.users.size + 1}`
      server.users.set(email, { password, uid })
      setUser({ uid, email })
    },
    async resetPassword() {},
    async signOut() {
      setUser(null)
    },
    async deleteAccount() {
      if (user?.email) server.users.delete(user.email)
      setUser(null)
    },
    async pullSince(uid, c, since) {
      return [...box(uid, c).values()].filter((d) => (d.syncedAt ?? 0) > since).map((d) => structuredClone(d))
    },
    async push(uid, c, docs) {
      for (const d of docs) box(uid, c).set(d.id, { ...structuredClone(d), syncedAt: ++server.clock })
    },
    async deleteAllData(uid) {
      server.data.delete(uid)
    },
  }
}

/** 개발 서버 화면 확인용: 한 페이지 안에서 같은 가짜 서버를 쓴다(window.__memoryServer로 들여다볼 수 있음) */
export function sharedMemoryBackend(): SyncBackend {
  const g = globalThis as { __memoryServer?: Server }
  g.__memoryServer ??= { clock: 0, users: new Map(), data: new Map() }
  return createMemoryBackend(g.__memoryServer)
}
