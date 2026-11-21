// 계정 상태(로그인한 사람·동기화 중·마지막 동기화 시각)와 로그인·동기화 동작. 화면은 useAccount()로 읽는다.
// Firebase SDK는 크기가 커서, 로그인한 적이 있거나(sync.signedIn) 설정의 계정 칸을 열 때만 불러온다.
import { useSyncExternalStore } from 'react'
import { askConfirm } from './confirm'
import { readPref, writePref } from './localPrefs'
import { authErrorText, errorCode, getSyncBackend, type SyncBackend, type SyncUser } from './syncBackend'
import { hasLocalData, runSync } from './syncRunner'
import { showToast } from './toast'

export interface AccountState {
  /** 서버를 불러왔는지(아직이면 계정 칸에 "불러오는 중") */
  loaded: boolean
  /** 서버 설정값이 있는지(없으면 "아직 서버가 설정되지 않았어요") */
  configured: boolean
  user: SyncUser | null
  syncing: boolean
  lastSyncAt: number | null
  error: string | null
}

/** 이 기기에서 마지막으로 로그인했던 계정(다른 계정으로 바꿀 때 묻기용) */
const LAST_UID_KEY = 'sync.lastUid'
/** 로그인해 있는지(앱을 열 때 Firebase를 불러올지 정함) */
const SIGNED_IN_KEY = 'sync.signedIn'
const LAST_AT_KEY = 'sync.lastAt'

let state: AccountState = {
  loaded: false,
  configured: false,
  user: null,
  syncing: false,
  lastSyncAt: readPref<number | null>(LAST_AT_KEY, null),
  error: null,
}
const subscribers = new Set<() => void>()
function set(patch: Partial<AccountState>) {
  state = { ...state, ...patch }
  subscribers.forEach((n) => n())
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    (n) => {
      subscribers.add(n)
      return () => subscribers.delete(n)
    },
    () => state,
  )
}

export const getAccount = () => state

let backendPromise: Promise<SyncBackend | null> | null = null

/** 서버를 불러와 로그인 상태를 듣기 시작(여러 번 불러도 한 번만) */
export function loadAccount(): Promise<SyncBackend | null> {
  backendPromise ??= getSyncBackend().then((backend) => {
    if (!backend) {
      set({ loaded: true, configured: false })
      return null
    }
    set({ loaded: true, configured: true })
    backend.onUser((user) => void handleUser(backend, user))
    return backend
  })
  return backendPromise
}

/** 앱을 열 때: 로그인해 둔 적이 있을 때만 서버를 불러온다(첫 화면을 가볍게) */
export function loadAccountIfSignedIn(): void {
  if (readPref<boolean>(SIGNED_IN_KEY, false)) void loadAccount()
}

async function handleUser(backend: SyncBackend, user: SyncUser | null) {
  const prev = state.user
  set({ user })
  writePref(SIGNED_IN_KEY, !!user)
  if (!user || prev?.uid === user.uid) return
  // 이 기기에서 전에 다른 계정을 썼고 데이터가 있으면, 이 계정에 합칠지 묻는다
  const lastUid = readPref<string | null>(LAST_UID_KEY, null)
  if (lastUid && lastUid !== user.uid && (await hasLocalData())) {
    const ok = await askConfirm({
      title: '다른 계정',
      message: '이 기기에는 다른 계정으로 쓰던 데이터가 있어요. 이 계정에 합칠까요?',
      ok: '합치기',
    })
    if (!ok) {
      await backend.signOut()
      return
    }
  }
  writePref(LAST_UID_KEY, user.uid)
  void syncNow()
}

let running: Promise<void> | null = null
let again = false

/** 지금 동기화(이미 도는 중이면 끝난 뒤 한 번 더). manual이면 결과를 토스트로 */
export async function syncNow(manual = false): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    const backend = await loadAccount()
    const user = state.user
    if (!backend || !user) return
    set({ syncing: true, error: null })
    try {
      const r = await runSync(backend, user.uid)
      const now = Date.now()
      writePref(LAST_AT_KEY, now)
      set({ lastSyncAt: now })
      if (manual) showToast(r.pulled || r.pushed ? `동기화했어요(받음 ${r.pulled} · 올림 ${r.pushed})` : '이미 맞춰져 있어요')
    } catch (err) {
      const msg = navigator.onLine ? '동기화하지 못했어요' : '인터넷에 연결되어 있지 않아요'
      set({ error: msg })
      if (manual) showToast(msg)
      console.warn('동기화 실패', err)
    } finally {
      set({ syncing: false })
    }
  })()
  try {
    await running
  } finally {
    running = null
  }
  if (again) {
    again = false
    await syncNow()
  }
}

/** 로그인·가입 등: 실패하면 화면 문구를 담은 오류를 던진다 */
async function withBackend(fn: (b: SyncBackend) => Promise<void>): Promise<void> {
  const backend = await loadAccount()
  if (!backend) throw new Error('아직 서버가 설정되지 않았어요')
  try {
    await fn(backend)
  } catch (err) {
    throw new Error(authErrorText(errorCode(err)))
  }
}

export const signIn = (email: string, password: string) => withBackend((b) => b.signIn(email.trim(), password))
export const signUp = (email: string, password: string) => withBackend((b) => b.signUp(email.trim(), password))
export const resetPassword = (email: string) => withBackend((b) => b.resetPassword(email.trim()))
export const signOutAccount = () => withBackend((b) => b.signOut())
