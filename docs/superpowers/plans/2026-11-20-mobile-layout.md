# 모바일 레이아웃 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 화면 폭 768px 이하에서 위 메뉴 줄 + 그래프(위) + 펼치고 접는 기기 목록(아래)으로 배치한다.

**Architecture:** `.app`의 grid를 `@media (max-width: 768px)`에서 `grid-template-areas`로 위→아래 3줄(메뉴 / 메인 / 목록)로 바꾼다. 컴포넌트 구조는 그대로 두고, 폰에서만 보이는 부품(목록 위 헤드폰|이어폰, 메뉴 줄의 "그래프" 버튼, 펼치기 손잡이)만 추가한다. PC 화면은 바뀌지 않는다.

**Tech Stack:** React + TypeScript, CSS(`index.css`), 확인은 Playwright 스크린샷.

**Spec:** `docs/superpowers/specs/2026-11-20-mobile-layout-design.md`

## Global Constraints
- 폰 기준: `@media (max-width: 768px)`. 이 밖의 CSS·동작은 바꾸지 않는다.
- 주석·화면 글자는 한국어. 헤드폰/이어폰 이름은 `categoryLabels`(labels.ts) 사용.
- 확인 명령: `npx tsc -b`, `npm run lint`(oxlint). 테스트 러너는 없음 → 화면은 Playwright로 Pixel 7과 1280×800 스크린샷.

## Review Focus
- PC 폭(1280px)에서 3단 배치·목록 폭 조절이 전과 같아야 함 → 각 Task 확인 단계에서 PC 스크린샷.
- 폰에서 EQ 화면을 연 뒤 기기·그래프 화면으로 돌아올 길이 있어야 함(카테고리 버튼이 목록 안으로 옮겨지므로) → Task 1의 "그래프" 버튼.
- 폰 가로 회전(약 915×412)은 768px 넘음 → PC 배치가 나옴. 이번 범위에서 허용.
- 목록을 펼쳐도 검색창 키보드가 올라올 때 화면이 깨지지 않아야 함(`dvh` 단위 사용).
- 가상 스크롤(`VirtualList`)은 목록 칸 높이가 바뀌어도 줄을 다시 그려야 함 → Task 2에서 펼친 뒤 스크롤해 확인.

---

### Task 1: 폰 폭 위아래 배치 + 메뉴 줄 + 목록 위 헤드폰|이어폰

**Files:**
- Modify: `src/index.css` (파일 끝에 `@media (max-width: 768px)` 블록 추가)
- Modify: `src/components/DeviceList.tsx` (Props에 `onCategoryChange`, `.list-search` 위에 `.list-category` 추가)
- Modify: `src/components/Sidebar.tsx` (폰에서만 보이는 "그래프" 버튼 `.nav-item.mobile-only`)
- Modify: `src/App.tsx` (`DeviceList`에 `onCategoryChange={setCategory}` 전달)

**Interfaces:**
- Produces: `DeviceList` Props `onCategoryChange: (c: DeviceCategory) => void`. CSS 클래스 `.list-category`(segmented), `.mobile-only`(PC에서 `display:none`).

- [ ] Step 1: `@media` 블록: `.app`을 `grid-template-columns: minmax(0,1fr)`, `grid-template-rows: auto minmax(0,1fr) auto`, areas `"top" "main" "list"`. `.sidebar`는 가로 한 줄(카테고리 버튼 숨김, "그래프"·EQ·설정만), `.list-col` 높이 `45dvh` + 위 테두리, `.main-col` area main, `.eq-page`는 rows 2/4, `.resize-handle`은 `display:none`.
- [ ] Step 2: `.list-category`(헤드폰|이어폰 반반 segmented, 누른 쪽 강조)는 PC에서 숨기고 폰에서만 보임. 누르면 `onCategoryChange`.
- [ ] Step 3: Sidebar "그래프" 버튼(폰 전용): `onChange(category)`로 기기 화면으로 돌아감. Sidebar에 `category`는 이미 있음.
- [ ] Step 4: `npx tsc -b && npm run lint` → 오류 0.
- [ ] Step 5: Pixel 7 스크린샷(목록·그래프 위아래, 헤드폰|이어폰 보임), 1280×800 스크린샷(전과 같음). 이어폰 눌러 목록이 바뀌는지, EQ → "그래프"로 돌아오는지 확인.
- [ ] Step 6: 커밋 "모바일: 그래프 위·목록 아래 배치, 목록 위 헤드폰/이어폰 전환"

### Task 2: 목록 펼치기/접기 손잡이

**Files:**
- Modify: `src/components/DeviceList.tsx` (상태 `expanded`, 맨 위 `.list-grip` 버튼, `.list-col.expanded`)
- Modify: `src/index.css` (`@media` 안: `.list-grip` 보이기, `.list-col.expanded { height: 80dvh }`)

**Interfaces:**
- Consumes: Task 1의 `@media` 블록과 `.mobile-only`.

- [ ] Step 1: `const [expanded, setExpanded] = useState(false)`(저장하지 않음). 손잡이 버튼 `aria-expanded`, 글자 ▲/▼, `aria-label` "목록 펼치기"/"목록 접기". PC에서는 숨김.
- [ ] Step 2: `npx tsc -b && npm run lint` → 오류 0.
- [ ] Step 3: Pixel 7에서 손잡이 눌러 펼침/접힘 스크린샷 2장, 펼친 상태에서 전체 기기 목록을 스크롤해 줄이 계속 그려지는지 확인. 1280×800은 전과 같음.
- [ ] Step 4: 커밋 "모바일: 기기 목록 펼치기/접기"
