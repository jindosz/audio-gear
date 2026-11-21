// 서버 창구의 Firebase 구현(Auth: 이메일 로그인, Firestore: 데이터).
// 저장 위치: users/{uid}/{묶음}/{id} 문서 = { updatedAt, deleted?, data? }. 보안 규칙(firestore.rules)으로 본인만 읽고 씀.
// 이 파일은 로그인 기능을 쓸 때만 불러온다(syncBackend.ts의 import()) → 첫 화면 크기에 Firebase가 안 들어감
import { initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { collection, doc, getDocs, initializeFirestore, query, where, writeBatch, type Firestore } from 'firebase/firestore'
import type { FirebaseConfig } from './firebaseConfig'
import type { SyncDoc } from './sync'
import type { SyncBackend, SyncCollection } from './syncBackend'
import { SYNC_TABLES } from './types'

/** Firestore 묶음 쓰기 한 번에 넣을 수 있는 최대 개수 */
const BATCH_LIMIT = 500

export function createFirebaseBackend(config: FirebaseConfig): SyncBackend {
  const app = initializeApp(config)
  const auth = getAuth(app)
  auth.languageCode = 'ko' // 비밀번호 재설정 메일을 한국어로
  // undefined 값이 든 필드는 빼고 저장(우리 레코드엔 선택 필드가 많음)
  const db: Firestore = initializeFirestore(app, { ignoreUndefinedProperties: true })
  const col = (uid: string, c: SyncCollection) => collection(db, 'users', uid, c)

  return {
    onUser(cb) {
      return onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null))
    },
    async signIn(email, password) {
      await signInWithEmailAndPassword(auth, email, password)
    },
    async signUp(email, password) {
      await createUserWithEmailAndPassword(auth, email, password)
    },
    async resetPassword(email) {
      await sendPasswordResetEmail(auth, email)
    },
    async signOut() {
      await signOut(auth)
    },
    async deleteAccount() {
      if (auth.currentUser) await deleteUser(auth.currentUser)
    },
    async pullSince(uid, c, since) {
      const snap = await getDocs(query(col(uid, c), where('updatedAt', '>', since)))
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SyncDoc, 'id'>) }))
    },
    async push(uid, c, docs) {
      for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db)
        for (const d of docs.slice(i, i + BATCH_LIMIT)) {
          const payload: Omit<SyncDoc, 'id'> = d.deleted
            ? { updatedAt: d.updatedAt, deleted: true }
            : { updatedAt: d.updatedAt, data: d.data }
          batch.set(doc(col(uid, c), d.id), payload)
        }
        await batch.commit()
      }
    },
    async deleteAllData(uid) {
      for (const c of [...SYNC_TABLES, 'ear'] as SyncCollection[]) {
        const snap = await getDocs(col(uid, c))
        for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
          const batch = writeBatch(db)
          for (const d of snap.docs.slice(i, i + BATCH_LIMIT)) batch.delete(d.ref)
          await batch.commit()
        }
      }
    },
  }
}
