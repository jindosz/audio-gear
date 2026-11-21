// Firebase 프로젝트 설정값(웹 앱 등록 때 콘솔이 보여 주는 값). 공개돼도 괜찮은 값이고,
// 남의 데이터를 못 보게 막는 건 서버의 보안 규칙(firestore.rules)이 한다.
// 아직 프로젝트를 만들기 전이라 null(계정 칸에 "아직 서버가 설정되지 않았어요"). 만드는 순서: docs/firebase-setup.md
export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
}

export const firebaseConfig: FirebaseConfig | null = null
