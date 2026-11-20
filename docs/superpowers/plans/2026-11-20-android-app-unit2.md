# 안드로이드 앱 2단계(폰 전체 EQ "폰에 적용") 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 안드로이드 앱의 EQ 화면에서 [폰에 적용]을 누르면 그 EQ가 폰 전체 소리(스포티파이 등)에 걸리고, 화면을 닫아도 유지되며, 알림의 "끄기"로 끌 수 있다.

**Architecture:** TS 순수 함수가 PEQ(피크 필터 + 프리앰프)를 127개 대역 게인으로 바꾸고, `src/eqEngine.ts`(EQ 엔진 창구)가 Capacitor 플러그인 `SystemEq`로 넘긴다. 네이티브 쪽은 포그라운드 서비스가 DynamicsProcessing 하나를 들고 있으며 값만 바꿔 다시 건다(시험 앱 ③④로 폴드7에서 확인된 방식).

**Tech Stack:** TypeScript·React(화면), vitest(변환 함수), Java(네이티브 플러그인·서비스 — Capacitor 템플릿이 Java라 Kotlin Gradle 플러그인을 더하지 않음), Capacitor 8 플러그인 API.

**Spec:** `docs/superpowers/specs/2026-11-20-android-eq-app-design.md`(작업 단위 2번). 시험 결과: 127밴드·0.3초 간격 값 변경 모두 잡음 없음, 유튜브 뮤직·스포티파이는 세션 신호를 보냄.

## Global Constraints
- 127개 주파수는 `eqExport.ts`의 `GRAPHIC_EQ_FREQS` 그대로. 밴드 i의 위쪽 끝 = i번째와 i+1번째 주파수의 기하 평균, 마지막 20000Hz.
- 밴드 게인은 +6dB / −24dB로 자르고, 입력 게인(프리앰프)은 0dB 이하.
- 방식: ① 세션 0(전체 출력) 기본. 효과를 못 만들거나 제어권이 없으면 ② 세션 신호 방식으로 바꾸고 상태에 표시.
- 플러그인 이름 `SystemEq`, 이벤트 이름 `statusChange`. 상태 `{ on: boolean; name?: string; mode?: 'global' | 'sessions'; error?: string }`.
- 효과 우선순위 `Integer.MAX_VALUE`. 서비스는 `foregroundServiceType="specialUse"`.
- 주석·화면 글자는 한국어. 확인: `npx tsc -b`, `npm run lint`, `npm test`, `npm run build`, `npm run build:android`. 네이티브 컴파일은 CI(미리 보기 APK)에서.
- 웹(배포 사이트)에서는 [폰에 적용] 버튼이 보이지 않는다.

## Review Focus
- 같은 EQ를 다시 적용하거나 다른 EQ로 바꿀 때 효과를 새로 만들지 않고 값만 바꾸는지(소리 끊김 방지) → Task 2 폰 확인.
- 알림의 "끄기"로 끈 뒤 앱 화면 상태가 "꺼짐"으로 바뀌는지(앱 밖에서 바뀐 상태) → Task 3 `statusChange` + Task 4 폰 확인.
- 앱을 완전히 닫았다가 다시 열었을 때 화면이 실제 상태(켜짐·이름)를 보여주는지 → Task 3 `status()`를 화면이 열릴 때 부름.
- 필터가 하나도 없는 EQ를 적용하면 평평(0dB)하게 걸리고 오류가 나지 않는지 → Task 1 테스트.
- 알림 권한을 거절해도 EQ가 걸리는지 → Task 4 폰 확인.

---

### Task 1: PEQ → 127밴드 변환(순수 함수)

**Files:** Create `src/eqDevice.ts`, `src/eqDevice.test.ts`

**Interfaces:**
- Produces: `interface DeviceEq { cutoffs: number[]; gains: number[]; inputGain: number }`, `toDeviceEq(eq: EqSettings): DeviceEq`, `DEVICE_EQ_FREQS`(= `GRAPHIC_EQ_FREQS`)
- Consumes: `totalResponse(filters, grid)`(eq.ts), `GRAPHIC_EQ_FREQS`, `EqSettings`(eqExport.ts)

- [ ] **Step 1: 실패하는 테스트**: `cutoffs`·`gains` 길이 127; `cutoffs[0]`≈√(20·21), 마지막 20000, 증가 순서; 필터 없음 → 게인 모두 0, `inputGain` = 프리앰프(예: −3 → −3); 1kHz +4dB Q1 필터 하나 → 1kHz에 가장 가까운 대역 게인 ≈ 4(±0.2), 20Hz 대역 ≈ 0(±0.1); 게인 +20dB 필터 → 그 대역 6으로 잘림, −40dB → −24; 프리앰프 +2 → `inputGain` 0.
- [ ] **Step 2:** `npm test` → 모듈 없음으로 실패 확인.
- [ ] **Step 3:** 구현(`totalResponse`를 127개 주파수에서 계산 후 자르기).
- [ ] **Step 4:** `npm test` 통과.
- [ ] **Step 5: 커밋** `PEQ를 안드로이드 127밴드 EQ로 바꾸는 함수(eqDevice.ts)와 테스트`

### Task 2: 네이티브 플러그인과 서비스(Java)

**Files:** Create `android/app/src/main/java/io/github/jindosz/audiogear/SystemEqPlugin.java`, `SystemEqService.java`. Modify `MainActivity.java`(`registerPlugin(SystemEqPlugin.class)`를 `super.onCreate` 전에), `AndroidManifest.xml`(권한 `MODIFY_AUDIO_SETTINGS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`, `POST_NOTIFICATIONS`; `<service android:name=".SystemEqService" android:exported="false" android:foregroundServiceType="specialUse">` + `PROPERTY_SPECIAL_USE_FGS_SUBTYPE`).

**Interfaces:**
- Produces(JS에서 부름): `apply({ name: string, cutoffs: number[], gains: number[], inputGain: number }) → status`, `off() → status`, `status() → status`, 이벤트 `statusChange(status)`
- 서비스: 시작 인텐트 `ACTION_APPLY`(extra: name, float[] cutoffs, float[] gains, float inputGain) / `ACTION_OFF`. 알림에 "끄기"(PendingIntent → `ACTION_OFF`). 상태가 바뀔 때 정적 리스너로 플러그인에 알림 → `notifyListeners("statusChange", ...)`. 마지막 적용값과 켜짐 여부를 SharedPreferences(`system_eq`)에 저장(3단계 재부팅 복원용).
- 동작: 효과가 이미 있고 밴드 수가 같으면 `setPreEqAllChannelsTo` + `setInputGainAllChannelsTo`로 값만 바꿈. 없으면 세션 0으로 만듦 → 실패하거나 `hasControl()`이 false면 세션 신호 방식으로(시험 앱 ②와 같은 리시버, `RECEIVER_EXPORTED`), 이미 열린 세션에도 같은 값 적용.
- 알림 권한 요청: 플러그인 `apply`에서 안드로이드 13+이고 권한이 없으면 한 번 요청(거절해도 계속 진행).

- [ ] **Step 1:** 위 파일 작성(시험 앱 `EqService.kt`의 구조를 Java로).
- [ ] **Step 2:** `npm run build:android` 통과, 커밋 후 푸시 → 미리 보기 CI가 Java 컴파일까지 성공하는지 확인.
- [ ] **Step 3: 커밋** `안드로이드: 폰 전체 EQ 플러그인(SystemEq)과 포그라운드 서비스`

### Task 3: EQ 엔진 창구

**Files:** Create `src/eqEngine.ts`, `src/eqEngine.test.ts`

**Interfaces:**
- Produces: `type EqStatus = { on: boolean; name?: string; mode?: 'global' | 'sessions'; error?: string }`, `interface EqEngine { kind: 'android' | 'none'; apply(name: string, eq: EqSettings): Promise<EqStatus>; off(): Promise<EqStatus>; status(): Promise<EqStatus>; onStatus(cb: (s: EqStatus) => void): () => void }`, `getEqEngine(): EqEngine`, React 훅 `useEqStatus(): EqStatus | null`(열릴 때 `status()`, 이후 `onStatus`)
- Consumes: `toDeviceEq`(Task 1), `isAndroidApp`(platform.ts), `registerPlugin('SystemEq')`(Task 2)

- [ ] **Step 1: 실패하는 테스트**: 브라우저(노드 테스트 환경 = web)에서 `getEqEngine().kind === 'none'`, `status()`가 `{ on: false }`.
- [ ] **Step 2:** 실패 확인 → 구현 → 통과.
- [ ] **Step 3: 커밋** `EQ 엔진 창구(eqEngine.ts): 안드로이드는 SystemEq, 웹은 없음`

### Task 4: EQ 화면 [폰에 적용]

**Files:** Modify `src/components/EqPage.tsx`, `src/index.css`(필요하면)

- [ ] **Step 1:** 편집 칸 위(이름 줄 아래)에 `kind === 'android'`일 때만: `ToggleButton` "폰에 적용"(켜짐 = 지금 적용 중인 EQ가 이 EQ) + 상태 한 줄("지금 폰에 적용 중: <이름> · 끄기" / "꺼짐" / 오류 문구, `mode === 'sessions'`면 "(재생 앱 신호 방식)" 덧붙임). 켜기 = `apply(draft.name, { filters, preamp })`, 끄기 = `off()`. 적용 중인 EQ id는 localStorage `eq.applied`(`localPrefs.ts`에 키 상수 `EQ_APPLIED_KEY`).
- [ ] **Step 2:** 확인: `npx tsc -b && npm run lint && npm test && npm run build`. 웹 Playwright에서 EQ 화면에 [폰에 적용]이 없는지.
- [ ] **Step 3: 커밋 후 푸시** `EQ 화면에 "폰에 적용" 버튼`
- [ ] **Step 4: 폰 확인(사용자)**: 미리 보기 APK 덮어쓰기 → EQ 하나 고르고 [폰에 적용] → 스포티파이 소리 변화 / 다른 EQ로 바꿔 적용 시 끊김 없음 / 앱 닫아도 유지 / 알림 "끄기" 후 앱 상태가 꺼짐 / 앱을 다시 열었을 때 상태 표시가 맞음.
- [ ] **Step 5:** CLAUDE.md 갱신(아키텍처·EQ 설계·다음 작업), 커밋.
