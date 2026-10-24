# audio-gear

헤드폰·이어폰을 측정치(FR 곡선)와 성향 정보와 함께 관리하고, 여러 기기를 그래프로 겹쳐 비교하는 개인용 웹앱.

## 작업 방식 (중요)

- 사용자는 개발 입문 단계의 개발자 지망생이다. 예전에 Flutter로 앱 하나를 만들어 본 경험이 있지만 기억이 희미하다.
- 코드를 작성하거나 고칠 때마다 무엇을 왜 바꿨는지, 새로 나온 용어나 개념은 무엇인지 짧게 설명한다.
- 한 번에 큰 변경을 하지 말고 작은 단위로 나눠 진행한다. 각 단위가 끝나면 동작 확인 방법을 알려주고 커밋을 제안한다.
- 답변은 한국어로 한다.
- 개발 환경: Windows, 프로젝트 경로 `C:\audio-gear`, PowerShell 사용.

## 기술 스택

- React + TypeScript + Vite (템플릿 `react-ts`)
- 저장: 브라우저 IndexedDB, Dexie.js(`dexie`, `dexie-react-hooks`)로 접근
- Chart.js(FR 그래프, 로그 축, `React.lazy`로 따로 불러옴), vite-plugin-pwa(설치·오프라인). 배포는 Cloudflare Pages 또는 GitHub Pages 예정(아직 안 정함. GitHub Pages면 `vite.config.ts`에 `base: '/audio-gear/'` 필요)
- 저장소: https://github.com/jindosz/audio-gear (main 브랜치)

## 아키텍처 결정

- 서버 없이 동작하는 로컬 퍼스트 정적 웹앱. 모든 계산(정규화, 차이 곡선 등)은 브라우저에서 처리한다.
- 폰에서는 PWA로 설치해서 사용. iOS 저장소 삭제에 대비해 `navigator.storage.persist()` 요청과 JSON 내보내기/가져오기 백업 기능을 넣는다.
- PC↔폰 동기화는 나중에 필요해지면 추가한다(Supabase/Firebase 등). 그때도 로컬 DB를 기본 저장소로 두고 서버는 동기화 대상으로만 쓴다. 데이터 접근 코드를 화면 코드와 분리해 두어 나중에 동기화를 붙이기 쉽게 한다. 화면 코드는 `db`를 직접 쓰지 않고 `src/repo.ts`의 함수를 통해 읽고 쓴다.
- AutoEQ(github.com/jaakkopasanen/AutoEq) 공개 목록을 "전체 기기" 카탈로그로 쓴다(`src/catalog.ts`). `results/INDEX.md`(전체 측정 결과)와 `results/README.md`(기기별 추천 측정치)를 받아 DB `meta` 테이블에 보관하고, 7일이 지나면 뒤에서 새로 받는다. 목록 기기를 클릭하면 그때 추천 측정치 CSV 하나만 받아 `source: "AutoEQ · 측정자"`로 저장하고 선택한다(전부 미리 받으면 수백 MB라 불가). raw.githubusercontent.com은 CORS를 허용한다. 측정치는 앱에 넣어 배포하지 않는다(권리는 각 측정자). crinacle 측정치는 CSV가 공개되어 있지 않아 crinacle 측정만 있는 기기는 "측정치 없음"으로 보인다. 다른 출처 추가와 카탈로그에 없는 기기 직접 입력은 `+` 팝업에서 한다. 다른 외부 DB가 CORS에 막히면 Cloudflare Workers 프록시를 검토한다.
- squig.link(리뷰어 120여 곳의 측정 사이트 모음)도 카탈로그에 합친다(`src/squig.ts`). `squig.link/squigsites.json` → 사이트별 `data/phone_book.json`(+ `config.js`의 `rig_description`으로 리그 추정, 대부분 없음)을 받아 줄인 형태로 `meta`(`squig.catalog`, 약 2.4MB)에 보관하고 7일마다 갱신. 처음 받기는 약 30초, 진행 상황은 `onSquigProgress`로 목록에 표시. 측정치는 클릭할 때 `<파일> L.txt`/`R.txt`(REW 형식, `parseFrCsv`로 읽힘)를 받아 평균 내 `source: "squig.link · 사이트 이름"`, 구성 설명은 variant로 저장. CORS 허용. crinacle(graph.hangout.audio)은 측정치 재사용을 원하지 않아 제외. 같은 기기는 공백·기호를 지운 이름(`src/text.ts`의 `normalize`)이 같으면 묶고, 이름·카테고리·클릭 시 받을 측정치는 AutoEQ를 우선한다. 추천용 데이터 받기는 AutoEQ만(squig.link는 수가 너무 많음).
- 기기 이름 정리(`src/nameClean.ts`, 순수 함수): 리뷰어가 손으로 만든 목록이라 표기가 제각각 → 구분선·메모 줄("------- ---", "EQ abuse:"), 글자 2개 미만, 괄호뿐인 이름은 제외. 앞 표시(*, _)·`[태그]`·`<태그>` 정리, 앞 분류 괄호는 뒤로("(DIY) X" → "X (DIY)"), 전각 괄호·짝 안 맞는 괄호·겹친 공백·"--" 정리. AutoEQ 이름에도 같은 표기 규칙 적용. 브랜드 대소문자는 이름 첫 단어 기준 다수결(AutoEQ 10표, squig 1표)로 맞춤. 측정치를 받을 수 없는 기기(943개, 주로 crinacle 측정만 있는 것)는 "전체 기기"에서 숨기고 `+` 팝업 검색에만 보임.
- 저장된 기기 정리(`src/deviceCleanup.ts` 계획 계산 + `repo.ts`의 `cleanupStoredDevices`): 이름 규칙 전에 저장된 기기를 같은 규칙으로 고치고(`[IEMs]` 태그면 이어폰으로), 기기가 아닌 이름은 측정치와 함께 삭제, 정리 후 카테고리·이름(normalize)이 같은 기기는 먼저 저장한 기기로 합침(보유·찜은 하나라도 켜져 있으면 유지, 메모 이어 붙이기, 측정치 옮기고 같은 출처·구성·채널 중복 제거). 앱을 처음 열 때 한 번 자동 실행(`useStartupCleanup.ts`, meta `cleanup.devices.v1`)하고 결과를 아래 안내(`.toast`)로 보여줌. 설정의 "저장된 기기 정리"로 다시 실행 가능.

## 데이터 구조 (`src/types.ts`, `src/db.ts`)

- `Device`: 기기. id, brand, model, category(`headphone` | `iem`), owned(보유 여부), wishlist(찜), 주요 특징 connection(`wired` | `wireless` | `both`)·acoustic(`open` | `semi-open` | `closed`)·codecs(블루투스 코덱 목록)·anc, notes, createdAt. wishlist와 특징 필드는 선택 필드(예전 데이터엔 없음, AutoEQ에도 없어 사용자가 기기 상세 팝업에서 입력) 입력값이 없으면 이름으로 추정한 값(`src/specHints.ts`)을 흐리게(기울임) 보여주고, 기기 상세 팝업의 "추정값 적용"을 눌러야 저장된다.
- `Measurement`: 측정치. deviceId로 기기를 가리킴. variant(이어팁·패드 등 구성), rig(`5128` | `711` | `gras` | `other`), source(`local` 또는 출처명), channel(`L` | `R` | `avg`), curve
- `Target`: 타깃 커브(Harman OE/IE 등). category, rig, isCustom, curve. 측정치와 같은 곡선 형식이라 불러오기 코드를 재사용한다.
- `CompareTab`: 비교 탭. selections(측정치 id + colorIndex 목록), normalizeHz(정규화 기준 주파수), targetId, diffRef(차이 곡선 기준: 'target' 또는 측정치 id, 선택 필드)
- `EqPreset`: 저장한 EQ. name, measurementId(EQ를 걸 기기 측정치), goal(''/'m:측정치 id'/'t:타깃 id'), filters(`PeakFilter` = freq·gain·q), createdAt, updatedAt
- `FrCurve`는 `{ freq: number; db: number }[]`
- 탭은 기기가 아니라 측정치를 선택한다(같은 기기의 구성별 비교 가능). 목록 클릭은 첫 번째 측정치를 선택하고, 다른/여러 측정치는 기기 상세 팝업의 "비교에 추가"로 고른다. 같은 기기가 여러 번 선택되면 그래프 이름 뒤에 구성/출처를 붙인다.
- 색은 실제 색 값이 아니라 팔레트 순번(colorIndex)만 저장한다. 라이트/다크 모드별 실제 색은 팔레트에서 정한다.
- Dexie 인덱스: `devices: 'id, category, createdAt'`, `measurements: 'id, deviceId, rig'`, `targets: 'id, category, rig'`, `tabs: 'id, createdAt'`, 버전 2에서 `meta: 'key'`, 버전 3에서 `summaries: 'path, category'`(추천용 요약값), 버전 4에서 `eqPresets: 'id, createdAt'` 추가(테이블 구조를 바꿀 때는 기존 version을 고치지 않고 새 version을 추가). IndexedDB는 boolean을 인덱스로 쓸 수 없어서 owned는 인덱스에서 뺐고 JS의 filter로 나눈다.

## 화면 설계

데스크톱 기준 3단 구성.

1. 왼쪽 메뉴: 카테고리(헤드폰, 이어폰), EQ 화면, 설정
2. 기기 목록: 위에 검색창, 그 아래 "선택됨 → 보유 기기 → 찜한 기기 → 전체 기기" 순서
   - 선택된 기기는 "선택됨" 구역으로 올라가고 원래 구역에서는 빠진다. 보유 기기면 "보유" 표시를 붙인다.
   - 각 줄의 별(☆/★)로 찜한다. 한 기기는 보유 > 찜 > 전체 중 한 곳에만 보인다. 아직 받지 않은 AutoEQ 기기를 찜하면 추천 측정치까지 받아 저장한다. 측정치 없는 내 기기를 클릭하면 AutoEQ에 있으면 받아온다.
   - "전체 기기" = 내 기기(보유 제외) + AutoEQ 목록 전체(현재 카테고리, 이름순). 수천 개라 가상 스크롤(`VirtualList.tsx`, 줄 높이 40px 고정)로 그린다.
   - 목록 칸 폭은 오른쪽 경계를 끌어서 200~640px로 조절(`ResizeHandle.tsx`, 두 번 누르면 260px, ←/→ 키도 됨, localStorage `listWidth`). 선택됨·보유·찜 구역은 제목을 눌러 접고 폄(localStorage `list.collapsed`). 많이 내려가면 오른쪽 아래 "맨 위로"(↑) 버튼. 브라우저별 화면 설정은 `src/localPrefs.ts`로 읽고 씀.
   - 검색창 옆 "필터" 버튼: 브랜드(선택 상자, 기기 수 표시)·유선/무선·ANC·오픈/밀폐(헤드폰만)로 거르기(`src/listFilter.ts` 순수 함수 + `ListFilterBar.tsx`). 특징은 입력값, 없으면 추정값 기준이라 정보가 없는 기기는 빠짐. 유·무선 겸용은 둘 다에 걸리고 오픈은 세미 오픈 포함. 필터는 카테고리마다 따로 기억(앱을 다시 열면 초기화), 선택됨 구역에는 적용하지 않음.
   - 목록 위 검색창 옆 `+` 버튼은 다른 출처 측정치 추가·직접 입력용 팝업을 연다. "전체 기기"에는 보유 기기를 다시 넣지 않는다.
   - 기기 클릭은 비교 선택에 쓰므로, 보유 토글·측정치 관리·삭제는 각 줄의 `⋯` 버튼으로 여는 기기 상세 팝업에서 한다.
3. 오른쪽 메인
   - 상단: 브라우저처럼 여러 비교 탭을 열고 닫고 전환. 선택 기기, 색 배정, 정규화 기준, 타깃은 탭마다 저장하고 앱을 다시 열면 복원한다.
   - 그래프 툴바: 정규화 기준 선택과 타깃 선택 드롭다운. 타깃은 현재 기기 종류(헤드폰/이어폰)에 맞는 것을 먼저 보여주고 나머지는 접어둔다. 기기 측정치와 타깃의 리그가 다르면 경고를 표시한다.
   - 그래프: FR 곡선 겹쳐보기. 타깃은 회색 점선으로 표시.
   - 차이 그래프: 툴바의 "차이 기준"(타깃 또는 선택한 측정치)을 고르면 FR 그래프 아래에 나머지 곡선 − 기준을 그린다. 기준이 선택에서 빠지면 꺼진 것으로 본다.

색 배정 규칙:
- 8색 팔레트(색각 이상 친화, `index.css`의 `--series-0`~`--series-7`, 라이트/다크 값 따로, dataviz 검증기 통과). 기기를 클릭으로 선택하면 비어 있는 첫 번째 색을 배정한다. 기기 클릭 시 그 기기의 첫 번째 측정치가 선택되고, 측정치가 없으면 상세 팝업을 연다.
- 선택 해제 시 다른 기기의 색은 바뀌지 않아야 한다.
- 목록 항목 배경은 같은 색의 연한 버전 + 왼쪽에 진한 색 띠. 다크 모드용 색은 따로 정의한다.
- 팔레트 개수가 동시 비교 최대 개수가 된다.

모바일: 왼쪽 두 칸은 햄버거 메뉴로 접고 그래프를 전체 폭으로 쓰는 반응형 레이아웃.

다크/라이트 모드: CSS 변수로 색을 정의하고 시스템 설정 또는 버튼으로 전환. 다크 색은 `@media (prefers-color-scheme: dark)` 안(`:root:not([data-theme=light])`)과 `:root[data-theme=dark]` 두 곳에 같은 값으로 적는다. 그래프처럼 색을 직접 읽는 화면은 `useResolvedTheme()`으로 테마 변화를 구독한다.

켜고 끄는 선택은 체크박스 대신 `ToggleButton`(켜지면 버튼 전체가 강조색으로 칠해짐), 여러 개 중 하나 고르기는 `.segmented` 버튼 묶음을 쓴다.

## 추천 기능 설계

AI 대신 앱 안의 계산기로 한다(근거를 숫자로 보여줄 수 있고 서버·비용이 필요 없음). 계산 함수는 `src/similarity.ts`(순수 함수).

- 질문: ① 이 기기와 비슷한 소리 ② 타깃에 가까운 기기 ③ 내 취향(여러 기기 평균 + "저음 +2dB" 같은 조절) ④ 지금 기기에서 일부만 바꾸기. 모두 "기준 곡선과의 거리"로 계산한다.
- 계산 순서: 공통 로그 간격으로 리샘플 → 300Hz~3kHz 평균을 0dB로 맞춤(한 점 정규화보다 덜 흔들림) → 1/6옥타브 스무딩 → 대역별 가중치를 둔 RMS 거리(10kHz 위는 측정 편차가 커서 제외) → 성향 지표(대역별 평균 차이)로 추천 이유 문장 생성.
- 후보 데이터: 기본은 "추천용 데이터 받기"로 카테고리 전체 추천 측정치를 내 기기에서 뒤에서 받아 **요약값(1/6옥타브, 곡선당 약 60개 숫자)만** DB에 저장한다(측정치를 재배포하지 않음). 앱에 요약 파일을 넣어 배포하는 방식은 측정치 재배포가 되어 쓰지 않는다.
- 정밀 비교(전체 곡선 2단계 재계산)는 검증 결과 효과가 작아 하지 않기로 함(아래 검증 참고). 대신 출처 우선순위로 정확도를 챙긴다.
- 계산기 검증(2026-10-22, AutoEQ oratory1990 측정, 기준 HD 600): HD 650 0.56dB < HD 800 S 1.81dB < Blessing 2(이어폰) 3.07dB로 상식과 맞음. 요약(1/6옥타브)과 정밀(1/12·1/24옥타브)의 거리 차이는 0.05dB 이하라 순위가 거의 안 바뀐다(10kHz 위를 빼서 좁은 피크 차이가 적게 반영됨).
- 같은 HD 600도 측정자·리그가 다르면(oratory1990 vs Rtings 5128) 2.13dB로 HD 800 S보다 멀게 나온다. 정확도에는 해상도보다 **측정 출처를 맞추는 것**이 훨씬 중요하다 → 추천은 기준과 같은 측정자(없으면 같은 리그) 후보를 우선하고, 다른 출처는 표시해서 구분한다.
- 작업 순서: 1) 계산기 ✅ 2) 추천 화면 ✅(후보 = 내 DB 측정치, `src/recommend.ts` + `RecommendDialog.tsx`, 툴바의 "비슷한 기기 찾기". 정렬: 같은 측정자 → 같은 리그 → 다른 출처(참고용), 각 묶음 안에서 거리순. 한 기기는 출처가 가장 잘 맞는 측정치 하나만) 3) 추천용 데이터 받기 ✅(`src/summaryJob.ts`, 추천 팝업의 데이터 상자에서 시작·멈추기·이어 받기. 동시 4개, 헤드폰 1,911개 기준 초당 약 8개 → 4분 정도. 요약값은 백업에 넣지 않음. 추천 결과는 묶음마다 15개) 4) 취향 기반·조절 슬라이더 ✅(`src/taste.ts`. 기준에 "비교 중인 기기 평균", "보유 기기 평균" 추가, 저음(150Hz 아래 셸프)·중고음(3kHz 벨)·고음(6kHz 위 셸프) ±6dB 슬라이더, 기준 곡선을 내 타깃으로 저장 가능. 평균 기준은 측정자·리그가 모두 같을 때만 그 출처를 물려받음) 5) (선택) Harman 선호도 점수(공식 계수는 구현 때 원 논문으로 확인)

## EQ로 들어보기 설계

- 목적: 지금 쓰는 기기에 EQ를 걸어 들어볼 기기와 비슷한 음색으로 미리 듣기. 스트리밍으로 듣는 게 기본이라, 웹앱은 다른 앱 소리를 바꿀 수 없음 → **앱 안 재생 대신 기기 전체 EQ 앱용 설정을 내보내고, 그 앱에서 켜고 끄며 비교**(임시 적용).
- 결정(2026-10-24): 웹앱(PWA)으로 유지하고, 실제 EQ 적용은 계속 외부 EQ 앱(Equalizer APO, Wavelet)으로 내보내서 한다. 데스크톱 앱 전환(Tauri/Electron)은 하지 않음. 이유: 기기 전체 EQ는 OS마다 네이티브 오디오 코드(Windows는 가상 오디오 장치·드라이버, Android는 Kotlin AudioEffect)를 따로 짜야 해서 부담이 너무 크고, iPhone은 어떤 앱이든 다른 앱 소리를 바꿀 수 없음. Electron은 모바일 미지원, Tauri 2는 모바일 앱은 되지만 전체 EQ는 결국 네이티브 코드가 필요. 앱 안 플레이어(Web Audio API로 내 음악 파일 재생)는 나중에 필요해지면 검토.
- 계산(`src/eq.ts`, 순수 함수): 목표 EQ = 들어볼 곡선 − 지금 곡선(1/3옥타브 스무딩, 300Hz~3kHz 평균 정규화). 부스트 최대 +6dB, 컷 최대 −12dB, 8kHz 위는 점점 덜 따라가 12kHz부터 0. 피크 필터(RBJ 쿡북 공식, 48kHz 기준)를 오차가 가장 큰 곳부터 최대 10개 놓고 좌표 하강으로 다듬음(Q ≤ 4). 프리앰프 = −(최대 부스트). 검증: HD 600 → HD 650/HD 800 S/LCD-2 오차 0.07~0.42dB.
- 내보내기(`src/eqExport.ts`): Equalizer APO(Windows, ParametricEQ "Preamp/Filter: ON PK" 형식), Wavelet(Android, AutoEq GraphicEQ 형식, 프리앰프 포함), 직접 입력(PEQ 값). OS를 userAgent로 감지해 기본 앱을 고르고 사용자가 바꿀 수 있음. iPhone은 기기 전체 EQ가 불가해 안내만.
- EQ 화면(왼쪽 메뉴 "EQ", `EqPage.tsx`, 목록·메인 칸을 합쳐 넓게 씀): 지금 쓰는 기기(DB의 모든 측정치, 보유 먼저) + 목표(없음/기기 측정치/내 타깃/기본 타깃). "목표에 맞춰 자동 계산"으로 밴드를 채우고 `EqBandTable.tsx`에서 주파수·게인(슬라이더+숫자)·Q를 직접 고치거나 밴드 추가·삭제(최대 20개). 프리앰프는 `autoPreamp`로 자동. 그래프는 원래/EQ 적용 후/목표(위)와 만든 EQ/필요한 EQ(아래). EQ는 여러 개 저장(DB `eqPresets`, 백업 포함)해 왼쪽 목록에서 눌러 바꾸고, 새로 만들기·복제·삭제·이름 바꾸기. 고친 내용은 0.3초 멈추면 자동 저장(다른 EQ로 바꾸면 바로 저장). 고른 EQ id는 localStorage `eq.active`. 자동 계산 때 이름이 "새 EQ n"이면 "기기 → 목표"로 이름을 붙임. 웹앱은 다른 앱(스트리밍) 소리에 EQ를 걸 수 없어서 실제 적용은 EQ 앱으로 내보내서 한다. 내보내기 칸은 `EqExport.tsx`로 팝업과 공유.
- 화면: 그래프 툴바의 "EQ로 들어보기"(`EqDialog.tsx`). 지금 쓰는 기기 = 보유 기기 측정치(+비교 중), 들어볼 소리 = 비교 중인 측정치 또는 타깃. 측정자가 다르거나 카테고리가 다르면 경고. 복사(막히면 글 선택 후 Ctrl+C 안내)·파일로 저장.

## 기능 로드맵

### 1단계 (MVP)
- [x] 데이터 타입 정의 (`src/types.ts`)
- [x] Dexie DB 정의 (`src/db.ts`)
- [x] 기기 추가 팝업: AutoEQ 카탈로그 검색 + 직접 추가, 보유/그 외 목록, 보유 토글, 삭제 (`src/components/AddDeviceDialog.tsx`)
- [x] CSV 측정치 업로드: 주파수,dB 형식 파싱 → Measurement로 저장 (구성, 리그, 채널 입력) (파서 `src/csv.ts`, 폼 `src/components/MeasurementUpload.tsx`)
- [x] 다크/라이트 모드 (설정 팝업의 시스템 설정/라이트/다크, `src/theme.ts`. 고른 값은 localStorage, `<html data-theme>`로 CSS 변수 전환)

### 2단계 (핵심 가치)
- [x] 3단 레이아웃과 비교 탭 구현 (`TabBar.tsx`, `useTabs.ts`. 보고 있던 탭 id는 localStorage에 저장)
- [x] FR 곡선 그래프(Chart.js, 로그 축), 기준점 정규화, 차이 곡선 (`src/curve.ts`, `FrChart.tsx`. 차이 기준은 툴바에서 고르고, 아래 작은 그래프에 "곡선 − 기준"을 그림)
- [x] 클릭 선택 시 색 자동 배정과 목록 배경 연동 (`src/selection.ts`, 선택은 첫 번째 비교 탭에 저장)
- [x] 타깃 선택 드롭다운과 리그 불일치 경고, 커스텀 타깃 CSV 불러오기 (기본 타깃 `src/targets.ts`, 커스텀은 드롭다운의 "+ CSV 불러오기…" → `CustomTargetDialog.tsx`, `isCustom: true`로 저장·삭제 가능)
- [x] 기기 삭제 시 연결된 측정치도 함께 삭제 (`deleteDevice`)
- [x] JSON 내보내기/가져오기 백업 (왼쪽 아래 설정 버튼 → `SettingsDialog.tsx`. 형식·검사는 `src/backup.ts`, 버전 필드로 나중 형식 변경 대비. 가져오기는 합치기/모두 바꾸기. AutoEQ 목록 보관본은 제외) + `navigator.storage.persist()` 요청
- [ ] PWA 적용과 배포 — PWA 완료(`vite-plugin-pwa`, 설정은 `vite.config.ts`, 아이콘은 `public/icon.svg` → `npx pwa-assets-generator`로 PNG 생성, `npm run build && npm run preview`로 확인. 개발 서버에서는 서비스 워커가 동작하지 않음), 배포 남음
- [x] 기기 주요 특징(유선/무선, 오픈/세미 오픈/밀폐, 코덱, ANC) 입력과 목록·추천 결과 태그 표시 (`labels.ts`의 `specTags`)
- [x] 특징 추정값: 헤드폰은 Claude가 확실히 아는 시리즈만 규칙으로(`src/data/headphoneHints.ts`, 키 = 이름 앞부분, 가장 긴 키가 이김, `{}`는 일부러 비움), 이어폰은 이름에 무선 단서(AirPods, Galaxy Buds, Sony WF-, TWS 등)가 있을 때만. 이어폰 "대부분 유선" 같은 기본값은 넣지 않음. 적용 범위: 헤드폰 3,037개 중 1,759개, 이어폰 260개(2026-10-24). 무작위 40개 점검과 확신이 덜한 6개 웹 확인에서 오류 없음

### 3단계 (나중에)
- [x] 두 곡선 차이로 PEQ 계산 → EQ 앱용 내보내기 ("EQ로 들어보기", 위 "EQ로 들어보기 설계" 참고)
- [x] 외부 공개 FR DB 추가 연동: squig.link (목록 약 4만 3천 개, 묶고 정리한 뒤 목록에 보이는 기기: 헤드폰 3,038·이어폰 10,043. 이름 앞 [IEMs] 같은 태그로 분류를 보정하고, AutoEQ에 없는 기기는 여러 사이트 분류의 다수결. 남은 것: 출처마다 이름 표기가 크게 다른 기기는 따로 보임, 예: "Moondrop x Crinacle Blessing2 Dusk" / "Moondrop Blessing 2 Dusk")
- [x] 측정치 기반 새 기기 추천(곡선 간 거리 계산) — "추천 기능 설계" 참고. 남은 선택 항목: Harman 선호도 점수, 특징(무선·밀폐 등) 필터
- [ ] FR에서 성향 지표 자동 추출(저음 셸프 양, 3kHz 대역, 5~8kHz 피크 등)과 태그 — 추천 계산기의 성향 지표와 같이 만든다
- [ ] 듣는 노래 기반 추천: 데이터 출처와 근거가 약해 실험 기능으로 보류. 장르 태그를 직접 고르는 가벼운 버전부터 검토
- [ ] 소스 출력 임피던스에 따른 FR 변화 시뮬레이션, PC↔폰 동기화

## 다음 작업

(2026-10-24 기준, 사용자가 다음에 하기로 한 것부터)

1. "EQ로 들어보기" 팝업(`EqDialog.tsx`)에서 만든 EQ를 EQ 목록(프리셋, `eqPresets`)에 저장하는 버튼. 저장할 때 지금 기기 측정치·목표(`m:`/`t:`)·필터를 그대로 넣고, 이름은 "기기 → 목표". 저장 후 EQ 화면으로 이동해 그 EQ를 고르게 할지 검토
2. (선택) 추천 결과 특징 필터, Harman 선호도 점수 — 필요해지면
3. 배포 (위치를 정한 뒤)
4. 모바일 반응형은 맨 마지막: 왼쪽 두 칸을 햄버거 메뉴로 접고 그래프를 전체 폭으로
