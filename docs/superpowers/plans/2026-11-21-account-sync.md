# 계정·동기화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이메일 계정으로 로그인하면 기기·측정치·내 타깃·비교 탭·EQ(+고르면 내 귀 설정)를 PC와 폰 사이에서 항목별로 맞춘다(나중에 고친 쪽이 이김, 지운 것도 전달).

**Architecture:** Dexie 훅(`src/syncStamp.ts`)이 동기화 대상 테이블에 쓸 때 `updatedAt`을 붙이고 지우면 `deletions` 테이블에 기록한다. 합치기 규칙은 서버를 모르는 순수 함수 `src/sync.ts`, 서버 창구는 `src/syncBackend.ts` 인터페이스(구현: `firebaseBackend.ts`, 시험용 `memoryBackend.ts`), 실행은 `src/syncRunner.ts`, 화면 상태는 `src/account.ts`.

**Tech Stack:** React 19 + TS, Dexie 4 훅, vitest, Firebase JS SDK(Auth + Firestore, 동적 `import()`)

**Spec:** `docs/superpowers/specs/2026-11-21-account-sync-design.md`

## Global Constraints

- 로컬이 기본: 로그인 안 했거나 인터넷이 없어도 지금처럼 동작. 서버 오류는 토스트 한 번, 앱은 계속.
- 동기화 테이블: `devices`, `measurements`, `targets`(isCustom만), `tabs`, `eqPresets`. 내 귀 설정(localStorage `ear.balance`·`ear.profile`)은 설정 "내 귀 설정 동기화" 켜졌을 때만(localStorage `sync.ear`, 기본 꺼짐).
- 안 올림: `meta`, `summaries`, 기본 타깃(isCustom 아님), 화면 설정.
- 규칙: 같은 id는 `updatedAt` 큰 쪽(같으면 서버), 서버 `deleted: true`면 로컬 삭제, 로컬 지우기 표시가 더 늦으면 서버에 `deleted`.
- 서버 경로 `users/{uid}/{table}/{id}`, 보안 규칙 본인만, 지역 `asia-northeast3`.
- 자동 동기화: 앱 열 때·앞으로 올 때·인터넷 다시 연결·마지막으로 고친 뒤 30초·화면 떠날 때, 한 번에 하나만.
- 묶음 쓰기 최대 500개. 지우기 표시는 서버에 올린 뒤 30일 지나면 정리.
- Firebase SDK는 로그인 기능을 쓸 때만 `import()`(첫 화면 크기 그대로).
- 화면 문구 "~했어요"체, 설명은 `Help`, 확인은 `askConfirm`, 토글 `ToggleButton`, 손가락 화면 44px 이상, 답변·주석 한국어, 커밋에 모델 이름 금지.

## Review Focus

1. 서버에서 받아 로컬에 넣는 쓰기가 다시 `updatedAt`을 새 시각으로 바꾸거나 지우기 표시를 남기면 끝없이 서로 덮어씀 → 받아 넣을 때는 훅이 손대지 않음(Task 1 테스트 `remote apply keeps updatedAt`).
2. 로그인 안 한 동안 지운 기기 → 나중에 로그인해 동기화하면 서버에서도 지워짐(지우기 표시는 로그인과 무관하게 남김, Task 1).
3. 다른 계정으로 로그인 → 이 기기 데이터를 그 계정에 합칠지 묻기(Task 3).
4. 동기화 도중 앱을 닫음 → 다음 번에 이어서 맞춰짐(`lastPulledAt`/`lastPushedAt`은 끝까지 성공했을 때만 갱신, Task 3).
5. Firebase 설정값이 아직 없음(`firebaseConfig.ts`가 비어 있음) → 계정 칸에 "아직 서버가 설정되지 않았어요", 다른 기능은 그대로(Task 2·3).

---

### Task 1: 고친 시각·지우기 표시와 합치기 규칙

**Files:** Modify `src/db.ts`, `src/types.ts`; Create `src/syncStamp.ts`, `src/sync.ts`, `src/sync.test.ts`

**Interfaces — Produces:**
- `SYNC_TABLES = ['devices', 'measurements', 'targets', 'tabs', 'eqPresets'] as const`, `type SyncTable`
- 레코드 공통 선택 필드 `updatedAt?: number`(Device·Measurement·Target·CompareTab에 추가, EqPreset은 이미 있음)
- DB version 5: `deletions: '[table+id], deletedAt'`, `interface Deletion { table: SyncTable; id: string; deletedAt: number }`
- `syncStamp.ts`: `installSyncStamp(db)` — 각 SYNC 테이블 `creating`/`updating` 훅에서 `updatedAt = Date.now()`, `deleting` 훅에서 트랜잭션이 끝나면 `deletions`에 기록. `runAsRemote<T>(fn: () => Promise<T>): Promise<T>` — 이 안의 쓰기는 훅이 손대지 않음. targets는 `isCustom`인 것만 기록
- `sync.ts`(순수): `interface SyncDoc { id: string; updatedAt: number; deleted?: boolean; data?: Record<string, unknown> }`, `interface MergePlan { putLocal: SyncDoc[]; deleteLocal: string[]; pushRemote: SyncDoc[] }`, `planMerge(local: SyncDoc[], localDeletions: Deletion[], remote: SyncDoc[], lastPushedAt: number): MergePlan`
- `recordUpdatedAt(r: { updatedAt?: number; createdAt?: number }): number`

- [ ] **Step 1: 테스트(`sync.test.ts`)** — 서버만 있는 것 → putLocal; 로컬만 있고 lastPushedAt보다 새것 → pushRemote; 같은 id 로컬이 더 새것 → pushRemote·putLocal 없음; 서버가 더 새것 → putLocal; 같으면 서버; 서버 deleted → deleteLocal; 로컬 지우기 표시가 서버보다 늦음 → pushRemote에 `{deleted: true}`; 지우기 표시가 서버 수정보다 이르면 서버 것이 살아남(putLocal); lastPushedAt보다 예전인 로컬은 다시 올리지 않음; `recordUpdatedAt({createdAt: 5})` → 5, `{}` → 0
- [ ] **Step 2~4:** 실패 확인 → 구현 → `npx vitest run src/sync.test.ts` 통과
- [ ] **Step 5:** `syncStamp.ts` + db version 5, `main.tsx`가 아니라 `db.ts`에서 `installSyncStamp(db)` 호출. Playwright로 개발 서버에서 기기 추가·수정·삭제 → `updatedAt`과 `deletions` 확인, `runAsRemote` 안 쓰기는 `updatedAt` 그대로(Review Focus 1)
- [ ] **Step 6:** `npx tsc -b && npm test` 통과, 커밋 "동기화: 고친 시각·지우기 표시와 합치기 규칙"

### Task 2: 서버 창구와 Firebase 구현

**Files:** Create `src/syncBackend.ts`, `src/memoryBackend.ts`, `src/firebaseBackend.ts`, `src/firebaseConfig.ts`, `firestore.rules`, `docs/firebase-setup.md`; Modify `package.json`(firebase)

**Interfaces:**
- Consumes: Task 1 `SyncDoc`, `SyncTable`
- Produces:
  - `interface SyncUser { uid: string; email: string | null }`
  - `interface SyncBackend { onUser(cb: (u: SyncUser | null) => void): () => void; signIn(email, pw): Promise<void>; signUp(email, pw): Promise<void>; resetPassword(email): Promise<void>; signOut(): Promise<void>; deleteAccount(): Promise<void>; pullSince(uid, table: SyncTable | 'ear', since: number): Promise<SyncDoc[]>; push(uid, table, docs: SyncDoc[]): Promise<void>; deleteAllData(uid): Promise<void> }`
  - `getSyncBackend(): Promise<SyncBackend | null>` — 설정값이 비었으면 null. 개발 서버에서 URL `?sync=memory`면 `memoryBackend`(시험용, 화면 확인에만)
  - `firebaseConfig: { apiKey: string; authDomain: string; projectId: string; appId: string } | null`(지금은 null)
  - Firebase 오류 코드 → 한국어 문구 `authErrorText(code: string): string`(wrong-password·user-not-found·invalid-credential → "이메일이나 비밀번호가 맞지 않아요", email-already-in-use, weak-password, invalid-email, network-request-failed, too-many-requests, 그 밖 "로그인하지 못했어요")
- [ ] **Step 1:** `memoryBackend` 기준 테스트(`syncBackend.test.ts`): push 뒤 pullSince(0)에 나옴, since 이후 것만, 다른 uid 안 보임, `authErrorText` 문구
- [ ] **Step 2~4:** 실패 → 구현(Firestore: `users/{uid}/{table}` 컬렉션, `where('updatedAt','>',since)`, `writeBatch` 500개씩, 문서 = `{ updatedAt, deleted?, data? }`) → 통과
- [ ] **Step 5:** `firestore.rules`(본인만), `docs/firebase-setup.md`(콘솔 순서: 프로젝트(Spark), Authentication 이메일/비밀번호, Firestore 서울·프로덕션 모드, 규칙 붙여 넣기, 웹 앱 등록 → 설정값 4개 전달, 승인된 도메인에 `jindosz.github.io`)
- [ ] **Step 6:** `npm run build` 크기 확인(첫 화면 묶음에 firebase가 안 들어감), 커밋

### Task 3: 동기화 실행과 계정 화면

**Files:** Create `src/syncRunner.ts`, `src/account.ts`, `src/components/AccountGroup.tsx`, `src/components/SignInDialog.tsx`; Modify `SettingsDialog.tsx`, `index.css`

**Interfaces:**
- Consumes: Task 1 `planMerge`, `runAsRemote`, `Deletion`; Task 2 `getSyncBackend`, `SyncBackend`
- Produces:
  - `syncNow(): Promise<{ pulled: number; pushed: number }>` — 테이블마다 pullSince(lastPulledAt) → planMerge → `runAsRemote`로 putLocal/deleteLocal → push → 끝까지 성공하면 localStorage `sync.state.<uid>` = `{ lastPulledAt, lastPushedAt }`(Review Focus 4). 올린 지우기 표시 중 30일 지난 것 정리. targets는 isCustom만
  - `account.ts`: `useAccount(): { configured: boolean; user: SyncUser | null; syncing: boolean; lastSyncAt: number | null; error: string | null }`, `signIn/signUp/signOut/resetPassword` 래퍼, 처음 로그인한 계정이 이 기기의 이전 계정(`sync.lastUid`)과 다르고 로컬 데이터가 있으면 `askConfirm("이 기기의 데이터를 이 계정에 합칠까요?")` — 아니오면 로그아웃(Review Focus 3)
- [ ] **Step 1:** 설정 맨 위 "계정" 묶음: 설정 안 됨 문구(Review Focus 5) / 로그인 전 [로그인 / 가입] → `SignInDialog`(이메일·비밀번호, [로그인]·[가입]·"비밀번호를 잊었어요") / 로그인 후 이메일 · "마지막 동기화 n분 전" · [지금 동기화] · [로그아웃]
- [ ] **Step 2:** `?sync=memory`로 두 브라우저 문맥을 흉내(같은 memory 저장을 `localStorage` 대신 `BroadcastChannel`… 이 아니라 한 페이지 안에서 로그아웃·다른 기기 흉내는 어려우므로): memoryBackend를 `window.__memoryServer`에 두고 Playwright가 한 문맥에서 push한 문서를 다른 문맥에 주입해 [지금 동기화] → 기기·EQ가 넘어오는지, 지운 기기가 다른 쪽에서 지워지는지 확인
- [ ] **Step 3:** `tsc`·lint·test, 폰·PC 스크린샷, 커밋·푸시·빌드

### Task 4: 자동 동기화·내 귀 설정·계정 삭제

**Files:** Modify `src/syncRunner.ts`, `src/account.ts`, `AccountGroup.tsx`, `App.tsx`, `earBalanceStore.ts`, `earEqStore.ts`, `CLAUDE.md`

**Interfaces:** Produces `setupAutoSync(): () => void`(App에서 한 번), `markDirty()`(syncStamp 훅과 내 귀 스토어가 부름 → 30초 뒤 `syncNow`), `deleteAccountAndData()`
- [ ] **Step 1:** 자동: 로그인 상태에서 시작·`resume`(앱)·`visibilitychange` visible·`online` → syncNow, `markDirty` 뒤 30초(다시 고치면 다시 30초), `visibilitychange` hidden → 바로, 한 번에 하나(돌고 있으면 끝난 뒤 한 번 더)
- [ ] **Step 2:** 내 귀 설정: `sync.ear` 켜기/끄기(계정 묶음 안), 켜져 있으면 `ear` 컬렉션 문서 2개(`balance`, `profile`)를 같은 규칙으로(스토어에 `updatedAt` 추가)
- [ ] **Step 3:** 고급 안 [계정 삭제]: `askConfirm`(danger) → `deleteAllData` → `deleteAccount`(최근 로그인 필요 오류면 "다시 로그인한 뒤 해 주세요"), 이 기기 데이터는 그대로
- [ ] **Step 4:** CLAUDE.md, `tsc`·lint·test, 커밋·푸시·빌드
