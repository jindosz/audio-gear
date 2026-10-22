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
- 예정: Chart.js(FR 그래프, 주파수 축은 로그 스케일), vite-plugin-pwa(폰 설치), Cloudflare Pages 또는 GitHub Pages(배포)
- 저장소: https://github.com/jindosz/audio-gear (main 브랜치)

## 아키텍처 결정

- 서버 없이 동작하는 로컬 퍼스트 정적 웹앱. 모든 계산(정규화, 차이 곡선 등)은 브라우저에서 처리한다.
- 폰에서는 PWA로 설치해서 사용. iOS 저장소 삭제에 대비해 `navigator.storage.persist()` 요청과 JSON 내보내기/가져오기 백업 기능을 넣는다.
- PC↔폰 동기화는 나중에 필요해지면 추가한다(Supabase/Firebase 등). 그때도 로컬 DB를 기본 저장소로 두고 서버는 동기화 대상으로만 쓴다. 데이터 접근 코드를 화면 코드와 분리해 두어 나중에 동기화를 붙이기 쉽게 한다. 화면 코드는 `db`를 직접 쓰지 않고 `src/repo.ts`의 함수를 통해 읽고 쓴다.
- 기기 추가는 AutoEQ(github.com/jaakkopasanen/AutoEq) 공개 목록을 카탈로그로 쓴다(`src/catalog.ts`). `results/INDEX.md`를 앱 실행 중 한 번 받아 검색하고, 기기를 고르면 그 출처의 측정치 CSV를 받아 `source: "AutoEQ · 측정자"`로 저장한다. raw.githubusercontent.com은 CORS를 허용한다. 측정치는 앱에 넣어 배포하지 않는다(권리는 각 측정자). crinacle 측정치는 CSV가 공개되어 있지 않아 기기만 추가된다. 카탈로그에 없는 기기는 팝업의 "직접 추가"로 입력한다. 다른 외부 DB가 CORS에 막히면 Cloudflare Workers 프록시를 검토한다.

## 데이터 구조 (`src/types.ts`, `src/db.ts`)

- `Device`: 기기. id, brand, model, category(`headphone` | `iem`), owned(보유 여부), notes, createdAt
- `Measurement`: 측정치. deviceId로 기기를 가리킴. variant(이어팁·패드 등 구성), rig(`5128` | `711` | `gras` | `other`), source(`local` 또는 출처명), channel(`L` | `R` | `avg`), curve
- `Target`: 타깃 커브(Harman OE/IE 등). category, rig, isCustom, curve. 측정치와 같은 곡선 형식이라 불러오기 코드를 재사용한다.
- `CompareTab`: 비교 탭. selections(측정치 id + colorIndex 목록), normalizeHz(정규화 기준 주파수), targetId
- `FrCurve`는 `{ freq: number; db: number }[]`
- 탭은 기기가 아니라 측정치를 선택한다(같은 기기의 구성별 비교 가능).
- 색은 실제 색 값이 아니라 팔레트 순번(colorIndex)만 저장한다. 라이트/다크 모드별 실제 색은 팔레트에서 정한다.
- Dexie 인덱스: `devices: 'id, category, createdAt'`, `measurements: 'id, deviceId, rig'`, `targets: 'id, category, rig'`, `tabs: 'id, createdAt'`. IndexedDB는 boolean을 인덱스로 쓸 수 없어서 owned는 인덱스에서 뺐고 JS의 filter로 나눈다.

## 화면 설계

데스크톱 기준 3단 구성.

1. 왼쪽 메뉴: 카테고리(헤드폰, 이어폰)와 설정
2. 기기 목록: 위에 검색창, 그 아래 "선택됨 → 보유 기기 → 전체 기기" 순서
   - 선택된 기기는 "선택됨" 구역으로 올라가고 원래 구역에서는 빠진다. 보유 기기면 "보유" 표시를 붙인다.
   - 전체 기기가 많아지면 가상 스크롤을 적용한다(초기에는 불필요).
   - 목록 위 검색창 옆 `+` 버튼으로 기기 추가 팝업을 연다. "전체 기기"에는 보유 기기를 다시 넣지 않는다.
   - 기기 클릭은 비교 선택에 쓰므로, 보유 토글·측정치 관리·삭제는 각 줄의 `⋯` 버튼으로 여는 기기 상세 팝업에서 한다.
3. 오른쪽 메인
   - 상단: 브라우저처럼 여러 비교 탭을 열고 닫고 전환. 선택 기기, 색 배정, 정규화 기준, 타깃은 탭마다 저장하고 앱을 다시 열면 복원한다.
   - 그래프 툴바: 정규화 기준 선택과 타깃 선택 드롭다운. 타깃은 현재 기기 종류(헤드폰/이어폰)에 맞는 것을 먼저 보여주고 나머지는 접어둔다. 기기 측정치와 타깃의 리그가 다르면 경고를 표시한다.
   - 그래프: FR 곡선 겹쳐보기. 타깃은 회색 점선으로 표시.

색 배정 규칙:
- 6~8색 팔레트(색각 이상 친화). 기기를 클릭으로 선택하면 비어 있는 첫 번째 색을 배정한다.
- 선택 해제 시 다른 기기의 색은 바뀌지 않아야 한다.
- 목록 항목 배경은 같은 색의 연한 버전 + 왼쪽에 진한 색 띠. 다크 모드용 색은 따로 정의한다.
- 팔레트 개수가 동시 비교 최대 개수가 된다.

모바일: 왼쪽 두 칸은 햄버거 메뉴로 접고 그래프를 전체 폭으로 쓰는 반응형 레이아웃.

다크/라이트 모드: CSS 변수로 색을 정의하고 시스템 설정 또는 버튼으로 전환.

## 기능 로드맵

### 1단계 (MVP)
- [x] 데이터 타입 정의 (`src/types.ts`)
- [x] Dexie DB 정의 (`src/db.ts`)
- [x] 기기 추가 팝업: AutoEQ 카탈로그 검색 + 직접 추가, 보유/그 외 목록, 보유 토글, 삭제 (`src/components/AddDeviceDialog.tsx`)
- [x] CSV 측정치 업로드: 주파수,dB 형식 파싱 → Measurement로 저장 (구성, 리그, 채널 입력) (파서 `src/csv.ts`, 폼 `src/components/MeasurementUpload.tsx`)
- [ ] 다크/라이트 모드

### 2단계 (핵심 가치)
- [ ] 3단 레이아웃과 비교 탭 구현 — 3단 뼈대·카테고리 메뉴·목록 검색·기기 상세 팝업(⋯) 완료, 비교 탭 남음
- [ ] FR 곡선 그래프(Chart.js, 로그 축), 기준점 정규화, 차이 곡선
- [ ] 클릭 선택 시 색 자동 배정과 목록 배경 연동
- [ ] 타깃 선택 드롭다운과 리그 불일치 경고, 커스텀 타깃 CSV 불러오기
- [x] 기기 삭제 시 연결된 측정치도 함께 삭제 (`deleteDevice`)
- [ ] JSON 내보내기/가져오기 백업
- [ ] PWA 적용과 배포

### 3단계 (나중에)
- [ ] 두 곡선 차이로 PEQ 계산 → Wavelet, Poweramp 등에 넣을 수 있게 내보내기 (앱 안 실시간 재생은 보류)
- [ ] 외부 공개 FR DB 추가 연동(AutoEQ 외 squig.link 등. 출처·이용 조건 확인, 출처 태깅 필수)
- [ ] 측정치 기반 새 기기 추천(곡선 간 거리 계산)
- [ ] FR에서 성향 지표 자동 추출(저음 셸프 양, 3kHz 대역, 5~8kHz 피크 등)과 태그
- [ ] 듣는 노래 기반 추천: 데이터 출처와 근거가 약해 실험 기능으로 보류. 장르 태그를 직접 고르는 가벼운 버전부터 검토
- [ ] 소스 출력 임피던스에 따른 FR 변화 시뮬레이션, PC↔폰 동기화

## 다음 작업

1. 클릭 선택 + 색 팔레트 + "선택됨" 구역 (목록 열)
2. FR 곡선 그래프(Chart.js, 로그 축)를 메인 영역에, 그다음 비교 탭
