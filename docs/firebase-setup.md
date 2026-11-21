# Firebase 프로젝트 만들기 (계정·동기화용)

audio-gear의 로그인과 PC↔폰 동기화는 Firebase(구글의 무료 서버 서비스)를 씁니다. 처음 한 번만 아래 순서대로 만들고, 마지막에 나오는 **설정값 4개**를 알려 주면 앱에 넣습니다. 10분 정도 걸립니다.

> 무료 요금제(Spark)로 만들고 **결제 수단은 등록하지 않습니다.** 그러면 무료 한도를 넘어도 요금이 나오지 않고 그날 동기화만 멈춥니다(앱은 그대로 동작).

## 1. 프로젝트 만들기
1. https://console.firebase.google.com 에 구글 계정으로 들어갑니다.
2. **[프로젝트 만들기]** → 이름: `audio-gear` (아무 이름이나 괜찮음) → 계속.
3. "Google 애널리틱스"는 **끔** → [프로젝트 만들기].

## 2. 로그인(이메일/비밀번호) 켜기
1. 왼쪽 메뉴 **빌드 → Authentication** → [시작하기].
2. **로그인 방법(Sign-in method)** 탭 → **이메일/비밀번호** → 첫 번째 스위치만 켜고 [저장]. ("이메일 링크"는 끈 채로)
3. **설정(Settings)** 탭 → **승인된 도메인(Authorized domains)** → [도메인 추가] → `jindosz.github.io` (배포 사이트에서 로그인하려면 필요. `localhost`는 원래 들어 있음)

## 3. 데이터베이스(Firestore) 만들기
1. 왼쪽 메뉴 **빌드 → Firestore Database** → [데이터베이스 만들기].
2. 위치: **asia-northeast3 (서울)** — 나중에 바꿀 수 없습니다.
3. **프로덕션 모드**로 시작 → [만들기].
4. 위쪽 **규칙(Rules)** 탭 → 안에 있는 내용을 모두 지우고 저장소의 `firestore.rules` 파일 내용을 그대로 붙여 넣기 → [게시].
   - 이 규칙이 "로그인한 사람은 자기 데이터만" 읽고 쓰게 막습니다. 빠뜨리면 동기화가 "권한 없음"으로 실패합니다.

## 4. 웹 앱 등록하고 설정값 받기
1. 왼쪽 위 톱니바퀴 → **프로젝트 설정** → 아래 "내 앱"에서 **웹(`</>`) 아이콘**.
2. 앱 닉네임: `audio-gear web` → "Firebase 호스팅"은 체크하지 않음 → [앱 등록].
3. 화면에 나오는 `firebaseConfig = { ... }` 중 아래 4개를 알려 주세요.
   ```
   apiKey: "..."
   authDomain: "....firebaseapp.com"
   projectId: "..."
   appId: "1:...:web:..."
   ```
   이 값들은 앱 안에 그대로 들어가는 **공개돼도 괜찮은 값**입니다(비밀번호가 아님). 남의 데이터를 막는 건 3-4의 보안 규칙입니다.

## 5. (권장) 웹 API 키 제한하기
웹 앱의 `apiKey`는 앱 안에 그대로 들어가 누구나 볼 수 있습니다. AI Studio가 만든 프로젝트(`gen-lang-client-…`)처럼 Gemini 등 다른 API가 켜져 있는 프로젝트라면, 이 키로 Firebase 말고 다른 API를 못 부르게 막아 두는 게 안전합니다.
1. https://console.cloud.google.com/apis/credentials (위쪽에서 그 프로젝트가 골라져 있는지 확인)
2. "API 키" 목록에서 값이 `apiKey`와 같은 키(보통 이름이 "Browser key (auto created by Firebase)")를 누름
3. **API 제한사항 → 키 제한** → 아래 3개만 체크 → [저장]
   - Identity Toolkit API (로그인)
   - Token Service API (로그인 유지)
   - Cloud Firestore API (데이터)
4. Gemini용으로 따로 만든 키는 건드리지 않습니다.

## 그 다음
- 설정값을 `src/firebaseConfig.ts`에 넣으면 설정 → "계정"에서 가입·로그인할 수 있습니다.
- 사용량은 콘솔의 **Firestore Database → 사용량(Usage)** 에서 볼 수 있습니다. 무료 한도(대략 하루 읽기 5만·쓰기 2만 번, 저장 1GB)는 개인·지인 규모면 충분합니다.
