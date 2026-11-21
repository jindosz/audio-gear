// Firebase 프로젝트 설정값(웹 앱 등록 때 콘솔이 보여 주는 값). 공개돼도 괜찮은 값이고,
// 남의 데이터를 못 보게 막는 건 서버의 보안 규칙(firestore.rules)이 한다.
// 만드는 순서: docs/firebase-setup.md. null로 두면 계정 칸에 "아직 서버가 설정되지 않았어요"
// (2026-11-21, AI Studio가 만들어 둔 Google Cloud 프로젝트에 Firebase를 붙임: 새 프로젝트는 계정 한도에 걸려서)
export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
}

export const firebaseConfig: FirebaseConfig | null = {
  apiKey: 'AIzaSyDIIiJqn6G5LQuuWs8Ev0g-nN7_tofAxMc',
  authDomain: 'gen-lang-client-0463982428.firebaseapp.com',
  projectId: 'gen-lang-client-0463982428',
  appId: '1:582100565401:web:9f75e033b1cfd06e092708',
}
