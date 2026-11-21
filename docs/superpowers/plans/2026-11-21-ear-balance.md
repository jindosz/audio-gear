# 내 귀 균형 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 좌·우 음량 차이를 "가운데 맞추기" 6번으로 재서 값 하나(dB)로 저장하고, 안드로이드 앱에서 폰 전체 소리에 채널별 입력 음량으로 적용한다.

**Architecture:** 계산은 순수 함수 `src/earBalance.ts`, 저장·적용 흐름은 `src/earBalanceStore.ts`(localStorage + `useSyncExternalStore`)가 `src/eqEngine.ts`를 통해 네이티브 `SystemEq` 플러그인을 부른다. 네이티브는 EQ와 함께 `balanceDb`를 받아 채널 0·1에 다른 입력 음량을 걸고, 시험 중에는 효과를 잠깐 끄는 bypass를 둔다. 시험 소리는 `src/tonePlayer.ts`(Web Audio), 화면은 `EarBalanceDialog.tsx`와 설정 줄.

**Tech Stack:** React 19 + TS, vitest, Web Audio API, Capacitor 8 자바 플러그인(DynamicsProcessing)

**Spec:** `docs/superpowers/specs/2026-11-21-ear-balance-design.md`

## Global Constraints

- 균형은 큰 쪽을 **줄이기만** 한다(소리를 키우지 않음). 값 = "오른쪽을 왼쪽보다 몇 dB 크게"(양수면 왼쪽 −db, 음수면 오른쪽 −|db|).
- 슬라이더 −12~+12dB, 0.5dB 단위. 순서 1k → 500 → 4k → 1k → 500 → 4k. 시작 위치 ±3~6dB 무작위.
- 흩어짐 경고: 같은 주파수 두 값 차이 > 3dB. 진료 권유: |결과| ≥ 10dB.
- 소리 −20dBFS, 0.4초 켜짐 / 0.3초 꺼짐, 30ms 페이드.
- localStorage `ear.balance` = `{ db, on, measuredAt }`, 백업에 넣지 않음. 네이티브는 SharedPreferences `system_eq`에 `balanceDb`.
- 화면 문구 "~했어요"체로 짧게, 설명은 `Help.tsx` 안. 토글은 `ToggleButton`, 확인 창은 `askConfirm`, `alert`/`confirm` 금지. 손가락 화면 44px 이상.
- 커밋 메시지·코드에 모델 이름 금지. 답변·주석은 한국어.

## Review Focus

1. 시험 팝업을 중간에 닫거나 뒤로 가기로 닫아도 bypass가 풀리고 소리가 멈춰야 한다 → Task 4에서 `Modal` 닫힘 시 `stop()` + `setBypass(false)`를 `finally`로.
2. 알림의 "끄기"로 서비스를 끄면 균형도 꺼진다(설정 값은 켜짐으로 남음) → 설정 줄은 "켜짐"이지만 폰 상태가 꺼져 있으면 "꺼져 있어요(다시 켜기)"를 보여 준다(Task 5).
3. EQ를 걸어 둔 상태에서 균형 값만 바꾸면 EQ는 그대로, 균형만 바뀌어야 한다 → `setBalance`는 EQ 값을 보내지 않음(Task 3), 스토어 테스트 대신 폰 확인 목록에 넣음.
4. 웹(브라우저)에서는 `eqEngine`이 none → 측정·저장은 되고 적용 함수는 아무것도 안 함(Task 2의 none 엔진 no-op).
5. 시험 소리가 블루투스에서 처음 0.3초 잘림 → 첫 소리 전에 0.3초 무음을 깔고 시작(Task 4 `tonePlayer.start`).

---

### Task 1: 순수 계산 `src/earBalance.ts`

**Files:**
- Create: `src/earBalance.ts`, `src/earBalance.test.ts`

**Interfaces:**
- Produces:
  - `BALANCE_FREQS = [1000, 500, 4000, 1000, 500, 4000] as const`
  - `BALANCE_MIN = -12`, `BALANCE_MAX = 12`, `BALANCE_STEP = 0.5`
  - `randomStart(rand: () => number): number` — ±3~6dB, 0.5 단위, 부호 무작위
  - `roundStep(db: number): number` — 0.5 단위 반올림, 범위로 자름
  - `interface BalanceResult { db: number; unstable: boolean; seeDoctor: boolean }`
  - `summarize(answers: number[]): BalanceResult` — 6개(BALANCE_FREQS 순서) 평균 반올림, 같은 주파수 두 값 차이 > 3이면 unstable, |db| ≥ 10이면 seeDoctor
  - `channelAttenuation(db: number): { left: number; right: number }` — 각 채널에 더할 dB(0 이하)
  - `balanceLabel(db: number): string` — 0이면 "가운데", 양수 "왼쪽 1.5dB 낮춤", 음수 "오른쪽 1.5dB 낮춤"

- [ ] **Step 1: 테스트 작성** — `summarize([2,1,2, 2,1,3])` → `{db: 2, unstable:false, seeDoctor:false}`(평균 1.83→2), `summarize([0,0,0,4,0,0])` → unstable true, `summarize([10,10,10,10,10,10]).seeDoctor` true, `channelAttenuation(1.5)` → `{left:-1.5,right:0}`, `channelAttenuation(-2)` → `{left:0,right:-2}`, `randomStart`이 rand 0·0.49·0.5·0.99에서 모두 |값| 3~6·0.5 단위, `roundStep(20)` → 12, `balanceLabel(-1.5)` → "오른쪽 1.5dB 낮춤", `balanceLabel(0)` → "가운데"
- [ ] **Step 2:** `npx vitest run src/earBalance.test.ts` → 실패 확인
- [ ] **Step 3:** 구현
- [ ] **Step 4:** 같은 명령 → 통과
- [ ] **Step 5:** 커밋 "내 귀 균형: 계산 함수"

### Task 2: 저장·적용 흐름 `src/earBalanceStore.ts` + `eqEngine.ts`

**Files:**
- Create: `src/earBalanceStore.ts`
- Modify: `src/eqEngine.ts`

**Interfaces:**
- Consumes: Task 1 `channelAttenuation`(네이티브가 같은 규칙을 씀, 웹은 값만 넘김)
- Produces:
  - `EqEngine`에 `setBalance(db: number): Promise<void>`(켜져 있을 때 값만 바꿈), `setBypass(on: boolean): Promise<void>`. none 엔진은 둘 다 no-op. `apply(name, eq, balanceDb)` 세 번째 인자 추가, 플러그인 apply 옵션에 `balanceDb`.
  - `interface EarBalance { db: number; on: boolean; measuredAt: string }`
  - `useEarBalance(): EarBalance | null`, `getEarBalance(): EarBalance | null`
  - `saveEarBalance(db: number): Promise<void>` — on: true로 저장 후 `syncEarBalance()`
  - `setEarBalanceOn(on: boolean): Promise<void>` — 저장 후 `syncEarBalance()`
  - `syncEarBalance(): Promise<void>` — 엔진 상태가 켜져 있으면 `setBalance(on ? db : 0)`, 단 지금 "균형만" 상태(이름 `EAR_BALANCE_NAME`)이고 균형이 꺼지면 `off()`. 꺼져 있고 균형이 켜져 있으면 `applyBalanceOnly()`
  - `EAR_BALANCE_NAME = '내 귀 균형'`, `applyBalanceOnly()` — 평평한 EQ(`{filters: [], preamp: 0}`)를 그 이름으로 apply
  - `currentBalanceDb(): number` — 켜져 있으면 db, 아니면 0. `applyPreset`이 이 값을 apply에 넘김
  - `turnOffPhoneEq()` 변경: 균형이 켜져 있으면 끄지 않고 `applyBalanceOnly()`

- [ ] **Step 1:** `toDeviceEq({filters: [], preamp: 0})`가 밴드 127개·게인 0을 돌려주는지 `src/eqDevice.test.ts`에 테스트 추가(평평한 EQ로 균형만 걸 때 필요) → 실행해 결과 확인(이미 통과하면 그대로 둠)
- [ ] **Step 2:** 구현. 순환 import를 피하려고 `earBalanceStore.ts`만 `eqEngine.ts`를 import한다. `eqEngine.ts`에는 `let balanceProvider = { db: () => 0, on: () => false }`와 `setBalanceProvider(p)`를 두고, 스토어가 불러올 때 등록한다. `applyPreset`은 `balanceProvider.db()`를 넘기고, `turnOffPhoneEq`는 `balanceProvider.on()`이면 균형만 건다(`applyBalanceOnly`도 `eqEngine.ts`에 둠)
- [ ] **Step 3:** `npx tsc -b && npm test` → 통과
- [ ] **Step 4:** 커밋 "내 귀 균형: 저장·적용 흐름"

### Task 3: 네이티브 `SystemEqPlugin.java`·`SystemEqService.java`

**Files:**
- Modify: `android/app/src/main/java/io/github/jindosz/audiogear/SystemEqPlugin.java`, `SystemEqService.java`

**Interfaces:**
- Consumes: Task 2의 플러그인 형식 `apply({name, cutoffs, gains, inputGain, balanceDb})`, `setBalance({balanceDb})`, `setBypass({on})`
- Produces: 서비스 `EXTRA_BALANCE = "balanceDb"`, `ACTION_BALANCE`, `ACTION_BYPASS`, `EXTRA_BYPASS = "bypass"`

- [ ] **Step 1:** 서비스에 `balanceDb` 필드. 채널별 입력 음량 = `inputGain + att` (`att` 왼쪽 = `-max(0, balanceDb)`, 오른쪽 = `-max(0, -balanceDb)`, `channelAttenuation`과 같은 규칙). `createEffect`는 `config.getChannelByChannelIndex(i).setInputGain(...)`, `updateOrRecreate`는 `effect.setInputGainbyChannelIndex(i, ...)`로 i = 0, 1. `saveLast`/`loadLast`에 `balanceDb`.
- [ ] **Step 2:** `ACTION_BALANCE`: 켜져 있으면 balanceDb만 바꿔 다시 걸고 저장(EQ 값 그대로), 꺼져 있으면 아무것도 안 함. `ACTION_BYPASS`: 모든 효과 `setEnabled(!bypass)`, 저장하지 않음. 새 효과를 만들 때 bypass 중이면 꺼진 채로.
- [ ] **Step 3:** 플러그인 `apply`에 `balanceDb`(기본 0), `@PluginMethod setBalance`, `@PluginMethod setBypass` — 서비스가 켜져 있을 때만 intent 보냄.
- [ ] **Step 4:** 커밋·푸시 → GitHub Actions Android app 빌드 성공 확인(로컬엔 안드로이드 SDK 없음)

### Task 4: 시험 소리와 측정 팝업

**Files:**
- Create: `src/tonePlayer.ts`, `src/components/EarBalanceDialog.tsx`
- Modify: `src/index.css`(팝업 모양)

**Interfaces:**
- Consumes: Task 1 전부, Task 2 `saveEarBalance`, `getEqEngine().setBypass`
- Produces:
  - `createTonePlayer(): { start(freq: number, balanceDb: number): void; setBalance(db: number): void; setFreq(freq: number): void; stop(): void }` — 사인파 −20dBFS, `GainNode` 왼쪽·오른쪽 → `ChannelMergerNode`, 큰 쪽만 줄임(`channelAttenuation`), 0.4초 켜짐/0.3초 꺼짐을 gain 자동화로, 30ms 페이드, 처음 0.3초 무음
  - `EarBalanceDialog({ open, onClose })`

- [ ] **Step 1:** 팝업 단계: 준비(볼륨 평소 크기, 도움말 접기에 안내 4줄, [시작]) → 6번(“3 / 6 · 1kHz”, 슬라이더 −12~+12 0.5 단위 양 끝 "왼쪽"/"오른쪽", 가운데 눈금, [다음]) → 결과(`balanceLabel`, unstable·seeDoctor 경고, [저장하고 적용]·[다시 재기]).
- [ ] **Step 2:** 시작 시 `setBypass(true)`, 닫힘·끝 `finally`에서 `stop()` + `setBypass(false)`(Review Focus 1).
- [ ] **Step 3:** `npx tsc -b && npm run lint` 통과, Playwright(폰·PC 크기)로 단계 넘김·결과 화면 스크린샷 확인
- [ ] **Step 4:** 커밋

### Task 5: 설정 줄·상태 줄·문서

**Files:**
- Modify: `src/components/SettingsDialog.tsx`, `src/components/PhoneEqControl.tsx`, `CLAUDE.md`

- [ ] **Step 1:** 설정 "성향 태그 보기" 아래 "내 귀 균형" 줄: 값(`balanceLabel` 또는 "아직 안 쟀어요"), 안드로이드 앱이면 `ToggleButton`(측정 전엔 숨김), [재기] → `EarBalanceDialog`. 웹이면 토글 대신 "안드로이드 앱에서 적용돼요". 켜짐인데 폰 상태가 꺼져 있으면 토글 누르면 다시 걸림(Review Focus 2).
- [ ] **Step 2:** `PhoneEqStatusBar`: 균형 켜짐이면 "균형 R −1.5dB" 작은 글자, 이름이 `EAR_BALANCE_NAME`이면 그대로 "내 귀 균형".
- [ ] **Step 3:** CLAUDE.md 로드맵 "청력 측정 EQ" 항목에 1단계 완료 기록, `tsc`·lint·test 통과, 커밋·푸시, 빌드 번호 확인
- [ ] **Step 4:** 폰 확인 목록 안내: 측정 → 적용 → 한쪽이 줄어드는지, EQ 걸린 상태에서 균형 값 바꿔도 EQ 유지, EQ 끄면 균형만 남음, 균형 끄면 서비스 멈춤, 재부팅 후 유지, 시험 중 뒤로 가기 → EQ 돌아옴
