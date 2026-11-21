// 동기화 서버 창구: 로그인과 "바뀐 것 받기·올리기"의 약속(인터페이스).
// 지금 구현은 Firebase(firebaseBackend.ts). 나중에 Cloudflare 등으로 옮기면 이 약속대로 구현 파일 하나만 새로 만든다.
// 합치기 규칙(sync.ts)과 실행(syncRunner.ts)은 서버 종류를 모른다.
import type { SyncDoc } from './sync'
import type { SyncTable } from './types'

export interface SyncUser {
  uid: string
  email: string | null
}

/** 서버에 저장하는 묶음: 동기화 테이블 + 내 귀 설정('ear', 고를 때만) */
export type SyncCollection = SyncTable | 'ear'

export interface SyncBackend {
  /** 로그인 상태가 바뀔 때마다 불림(처음 한 번도). 돌려준 함수로 그만 받기 */
  onUser(cb: (user: SyncUser | null) => void): () => void
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string): Promise<void>
  /** 비밀번호 다시 정하기 메일 보내기 */
  resetPassword(email: string): Promise<void>
  signOut(): Promise<void>
  /** 계정 지우기(서버 데이터는 deleteAllData로 먼저 지운다) */
  deleteAccount(): Promise<void>
  /** since(ms)보다 나중에 고친 문서만 */
  pullSince(uid: string, collection: SyncCollection, since: number): Promise<SyncDoc[]>
  /** 같은 id는 덮어씀 */
  push(uid: string, collection: SyncCollection, docs: SyncDoc[]): Promise<void>
  deleteAllData(uid: string): Promise<void>
}

/** 서버 오류(Firebase 오류 코드 등) → 화면 문구 */
export function authErrorText(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '이메일이나 비밀번호가 맞지 않아요'
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일이에요'
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 해요'
    case 'auth/invalid-email':
      return '이메일 형식이 맞지 않아요'
    case 'auth/network-request-failed':
      return '인터넷에 연결되어 있지 않아요'
    case 'auth/too-many-requests':
      return '시도가 너무 많아요. 잠시 뒤 다시 해 주세요'
    case 'auth/requires-recent-login':
      return '보안을 위해 다시 로그인한 뒤 해 주세요'
    default:
      return '로그인하지 못했어요'
  }
}

/** 오류 객체에서 코드(예: "auth/invalid-credential")를 꺼낸다 */
export function errorCode(err: unknown): string {
  return typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : ''
}

let backend: Promise<SyncBackend | null> | null = null

/**
 * 서버 창구(처음 부를 때 한 번 불러옴). Firebase 설정값이 아직 없으면 null.
 * 개발 서버에서 주소 끝에 ?sync=memory를 붙이면 브라우저 안의 가짜 서버(화면 확인용)
 */
export function getSyncBackend(): Promise<SyncBackend | null> {
  backend ??= (async () => {
    if (import.meta.env.DEV && new URLSearchParams(location.search).get('sync') === 'memory') {
      const { sharedMemoryBackend } = await import('./memoryBackend')
      return sharedMemoryBackend()
    }
    const { firebaseConfig } = await import('./firebaseConfig')
    if (!firebaseConfig) return null
    const { createFirebaseBackend } = await import('./firebaseBackend')
    return createFirebaseBackend(firebaseConfig)
  })()
  return backend
}
