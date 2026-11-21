# audio-gear

헤드폰·이어폰을 측정치(FR 곡선)와 성향 정보와 함께 관리하고, 여러 기기를 그래프로 겹쳐 비교하는 개인용 웹앱.

## 작업 방식 (중요)

- 사용자는 개발 입문 단계의 개발자 지망생이다. 예전에 Flutter로 앱 하나를 만들어 본 경험이 있지만 기억이 희미하다.
- 코드를 작성하거나 고칠 때마다 무엇을 왜 바꿨는지, 새로 나온 용어나 개념은 무엇인지 짧게 설명한다.
- 한 번에 큰 변경을 하지 말고 작은 단위로 나눠 진행한다. 각 단위가 끝나면 동작 확인 방법을 알려주고 커밋을 제안한다.
- 답변은 한국어로 한다.
- APK 빌드가 도는 푸시(`src/`·`android/` 등을 바꾼 커밋, `.github/workflows/android.yml`의 `paths`)를 했으면 답변 맨 끝에 항상 **몇 버전이 올라가는지**("미리 보기 0.1.N (빌드 N)" 또는 "정식 0.1.N", 빌드 번호 = Actions의 Android app 실행 번호)를 적는다. 빌드가 끝났는지(성공/진행 중)도 확인해서 같이 알려준다(2026-11-21 사용자 요청).
- 개발 환경: Windows, 프로젝트 경로 `C:\audio-gear`, PowerShell 사용.
- 앱은 **PC(마우스)와 폰(손가락) 둘 다**에서 쓴다. 화면을 고칠 때 둘 다 확인하고, 터치용 크기 조정은 `@media (pointer: coarse)`, PC는 촘촘하게 유지.

## 기술 스택

- React + TypeScript + Vite (템플릿 `react-ts`)
- 테스트: `npm test`(vitest, 순수 함수용 `src/*.test.ts`)
- 디자인 참고 스킬: `.claude/skills/ui-ux-pro-max/`(2026-11-20 설치, github.com/nextlevelbuilder/ui-ux-pro-max-skill 커밋 2de1134, MIT, 테스트 폴더 제외). UI를 고칠 때 `SKILL.md`·`references/`의 규칙을 참고. 검색 스크립트는 프로젝트 기준 `python3 .claude/skills/ui-ux-pro-max/scripts/search.py "<검색어>" --domain <분야>`(SKILL.md의 `${CLAUDE_PLUGIN_ROOT}` 경로 대신, 외부 스크립트라 실행은 권한 허용 필요)
- 저장: 브라우저 IndexedDB, Dexie.js(`dexie`, `dexie-react-hooks`)로 접근
- Chart.js(FR 그래프, 로그 축, `React.lazy`로 따로 불러옴), vite-plugin-pwa(설치·오프라인). 배포는 GitHub Pages(2026-11-07 결정, 주소 https://jindosz.github.io/audio-gear/). `vite.config.ts`의 `base`는 빌드·`npm run preview`일 때만 `/audio-gear/`, 개발 서버는 `/`(Vite는 preview도 command가 `serve`라 `isPreview`로 구분). main에 푸시하면 `.github/workflows/deploy.yml`이 빌드해서 올림(저장소 Settings → Pages → Source = GitHub Actions). 무료 플랜은 공개 저장소만 Pages 가능. 배포한 사이트는 localhost와 출처(origin)가 달라 IndexedDB·localStorage가 따로라, 기존 데이터는 설정의 JSON 백업 내보내기 → 가져오기로 옮김
- 저장소: https://github.com/jindosz/audio-gear (main 브랜치)
- 안드로이드 앱(2026-11-20 1단계 완료, 설계 `docs/superpowers/specs/2026-11-20-android-eq-app-design.md`, 계획 `docs/superpowers/plans/2026-11-20-android-app-unit1.md`): Capacitor 8.6(`capacitor.config.ts`, appId `io.github.jindosz.audiogear`)로 같은 웹 코드를 감싼 앱. `npm run build:android` = `vite build --mode capacitor`(base `./`, PWA·서비스 워커 끔) + `cap sync android`. `android/`는 Capacitor 표준 프로젝트(저장소에 커밋, 아이콘은 `assets/icon.png`에서 `@capacitor/assets`로 생성). APK는 `.github/workflows/android.yml`이 빌드: main 푸시는 Releases `android-latest`(정식 설치 링크), `claude/**` 작업 브랜치 푸시는 `android-preview`(미리 보기, prerelease)에 `audio-gear-0.1.<빌드 번호>.apk`로 올림(올리기 전 그 릴리스의 이전 APK는 `gh release delete-asset`으로 지움, versionCode = 실행 번호, 브랜치별로 따로 줄 세움). 앱 안 웹 주소(`capacitor.config.ts`의 `server` = `https://localhost`)는 IndexedDB가 묶여 있어 절대 바꾸지 않음. 서명은 저장소 Secrets 4개(`ANDROID_KEYSTORE_BASE64`·`ANDROID_KEYSTORE_PASSWORD`·`ANDROID_KEY_ALIAS`·`ANDROID_KEY_PASSWORD`, 키는 사용자 PC에 보관)로 고정 → 덮어쓰기 업데이트. 사용자용 설치 안내 `docs/android-install.md`. 앱 데이터는 배포 사이트와 따로라 JSON 백업으로 옮김. **폰 전체 EQ(2단계, 2026-11-20 완료)**: EQ 화면의 [폰에 적용](`PhoneEqControl.tsx`, 안드로이드 앱에서만 보임. 걸어 둔 뒤 고치면 "변경 사항 적용"으로 끊김 없이 다시 걸기, EQ 화면 맨 위 `PhoneEqStatusBar`는 켜져 있으면 늘 이름과 "끄기"를 보여줌) → EQ 엔진 창구 `src/eqEngine.ts`(`getEqEngine()`: 안드로이드 = 플러그인 `SystemEq`, 웹 = none. `applyPreset`/`turnOffPhoneEq`/`useEqStatus`/`useAppliedEq`, 건 EQ id와 값 서명은 localStorage `eq.applied`) → `src/eqDevice.ts`(`toDeviceEq`: 피크 필터 합 응답을 Wavelet과 같은 127개 주파수에서 계산, 밴드 끝 = 이웃 주파수 기하 평균·마지막 20000Hz, 게인 +6/−24dB로 자름, 프리앰프 = 입력 게인 0dB 이하) → `android/.../SystemEqPlugin.java`(apply/off/status, `statusChange` 이벤트) → `SystemEqService.java`(포그라운드 서비스 `specialUse`, DynamicsProcessing 우선순위 최대, 세션 0 기본·안 되면 재생 앱 세션 신호, EQ를 바꿀 때 값만 바꿈, 알림 "끄기", 마지막 값 SharedPreferences `system_eq`). 폴드7에서 적용·끊김 없는 전환·앱 닫아도 유지·알림 끄기·다시 열었을 때 상태 표시 확인. **3단계(2026-11-20, 계획 `docs/superpowers/plans/2026-11-20-android-app-unit3.md`)**: 걸어 둔 EQ를 고치면 0.3초 멈춘 뒤 자동으로 다시 걸기(버튼 없음), "EQ로 들어보기"에 [폰에 적용](저장 후 적용), 서비스 `START_STICKY` + 인텐트 없이 재시작되거나 `BootReceiver`(BOOT_COMPLETED)가 `ACTION_RESTORE`를 보내면 SharedPreferences의 마지막 EQ를 다시 걸기(꺼짐으로 저장돼 있으면 아무것도 안 함), 세션 신호 방식 효과 최대 16개, 알림 권한은 처음 한 번만 묻기(`askedNotification`), 뒤로 가기(`src/backButton.ts`, `@capacitor/app`): 열린 `<dialog>`를 닫고, 없으면 처음엔 "한 번 더 누르면 앱을 닫아요" 안내(`showToast`, `src/toast.ts` + App의 `ToastHost.tsx`, 아래 가운데 알약)만 띄우고 2초 안에 한 번 더 누르면 앱을 뒤로 보냄(`minimizeApp`, 판단은 순수 함수 `src/backExit.ts`, 2026-11-21), 설정의 저장 공간 보존 칸은 앱에서 숨김. 시험 앱(`android-spike/`)과 그 빌드 작업은 삭제(Releases `eq-spike`는 GitHub에서 직접 지움). 플랫폼마다 다른 일은 `src/platform.ts`(`isAndroidApp`, `saveTextFile`: 앱 안에서는 `<a download>`·`navigator.share`가 안 되어 `@capacitor/filesystem` + `@capacitor/share` 공유 창). 폰(폴드7·안드로이드 17)에서 설치·화면·목록 받기·백업 가져오기/내보내기, 새 APK 덮어쓰기 설치 시 데이터 유지까지 확인. 빌드 번호: CI가 `VITE_BUILD_NUMBER`·`VITE_COMMIT`(실행 번호·커밋)을 넣어 설정 화면 맨 아래에 "안드로이드 앱 0.1.N (빌드 N) · 커밋 …"(웹은 "웹 (빌드 N)", `src/buildInfo.ts`)으로 표시, 릴리스 제목에도 빌드 번호

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
   - 각 줄의 보유 버튼(동그라미 체크, `OwnedIcon`)으로 바로 보유/해제하고, 별로 찜한다(둘 다 마우스를 올리면 보이고, 켜져 있거나 터치 화면이면 늘 보임). 아직 받지 않은 목록 기기를 보유로 하면 측정치까지 받아 보유 기기로 저장. 한 기기는 보유 > 찜 > 전체 중 한 곳에만 보인다. 아직 받지 않은 AutoEQ 기기를 찜하면 추천 측정치까지 받아 저장한다. 측정치 없는 내 기기를 클릭하면 AutoEQ에 있으면 받아온다.
   - "전체 기기" = 내 기기(보유 제외) + AutoEQ 목록 전체(현재 카테고리, 이름순). 수천 개라 가상 스크롤(`VirtualList.tsx`, 줄 높이 40px 고정)로 그린다.
   - 목록 칸 폭은 오른쪽 경계를 끌어서 200~640px로 조절(`ResizeHandle.tsx`, 두 번 누르면 260px, ←/→ 키도 됨, localStorage `listWidth`). 선택됨·보유·찜 구역은 제목을 눌러 접고 폄(localStorage `list.collapsed`). 많이 내려가면 오른쪽 아래 "맨 위로"(↑) 버튼. 브라우저별 화면 설정은 `src/localPrefs.ts`로 읽고 씀.
   - 검색창 옆 "필터" 버튼: 브랜드(선택 상자, 기기 수 표시)·측정자(선택 상자, 측정치 source 형식 "AutoEQ · oratory1990"/"squig.link · 사이트", 기기 수 많은 순)·유선/무선·ANC·오픈/밀폐(헤드폰만)로 거르기. 측정자를 고르면 그 측정자가 잰 기기만 남고, 기기를 누르면 그 측정자의 측정치를 받아 선택(`catalog.ts`의 `entryFor`, `CatalogDevice.curves`·`measurers`)해 같은 측정자끼리 비교할 수 있음(`src/listFilter.ts` 순수 함수 + `ListFilterBar.tsx`). 특징은 입력값, 없으면 추정값 기준이라 정보가 없는 기기는 빠짐. 유·무선 겸용은 둘 다에 걸리고 오픈은 세미 오픈 포함. 필터는 카테고리마다 따로 기억(앱을 다시 열면 초기화), 선택됨 구역에는 적용하지 않음.
   - 목록 위 검색창 옆 `+` 버튼은 다른 출처 측정치 추가·직접 입력용 팝업을 연다. "전체 기기"에는 보유 기기를 다시 넣지 않는다.
   - 기기 클릭은 비교 선택에 쓰므로, 보유 토글·측정치 관리·삭제는 각 줄의 `⋯` 버튼으로 여는 기기 상세 팝업에서 한다.
3. 오른쪽 메인
   - 상단: 브라우저처럼 여러 비교 탭을 열고 닫고 전환. 선택 기기, 색 배정, 정규화 기준, 타깃은 탭마다 저장하고 앱을 다시 열면 복원한다.
   - 그래프 툴바(2026-11-20 순서 변경): 위 줄 = 자주 쓰는 [EQ로 들어보기](강조)·[비슷한 기기 찾기], 아래 = 그래프 설정 타깃 → 차이 기준 → 정규화 기준(`.toolbar-actions`/`.toolbar-settings`, 폰은 두 버튼이 반씩). 설정은 처음부터 한 줄에 하나씩(2026-11-21, 이름 칸 폭 고정 + 선택 상자가 남은 폭을 채우고 길면 …, PC 최대 560px. 예전엔 옆으로 늘어놓아 고른 이름이 길어질 때만 아래로 밀려 배치가 들썩였음). 타깃은 현재 기기 종류(헤드폰/이어폰)에 맞는 것을 먼저 보여주고 나머지는 접어둔다. 기기 측정치와 타깃의 리그가 다르면 경고를 표시한다.
   - 그래프: FR 곡선 겹쳐보기. 타깃은 회색 점선으로 표시.
   - 차이 그래프: 툴바의 "차이 기준"(타깃 또는 선택한 측정치)을 고르면 FR 그래프 아래에 나머지 곡선 − 기준을 그린다. 기준이 선택에서 빠지면 꺼진 것으로 본다.

색 배정 규칙:
- 8색 팔레트(색각 이상 친화, `index.css`의 `--series-0`~`--series-7`, 라이트/다크 값 따로, dataviz 검증기 통과). 기기를 클릭으로 선택하면 비어 있는 첫 번째 색을 배정한다. 기기 클릭 시 그 기기의 첫 번째 측정치가 선택되고, 측정치가 없으면 상세 팝업을 연다.
- 선택 해제 시 다른 기기의 색은 바뀌지 않아야 한다.
- 목록 항목 배경은 같은 색의 연한 버전 + 왼쪽에 진한 색 띠. 다크 모드용 색은 따로 정의한다.
- 팔레트 개수가 동시 비교 최대 개수가 된다.

모바일(화면 폭 768px 이하, `index.css` 끝의 `@media` 블록, 2026-11-20): 위에서부터 메뉴 줄(그래프·EQ·테마·설정) → 비교 탭·그래프 → 기기 목록(기본 화면 높이 45%, 높이 700px 이하 폰은 38%, CSS 변수 `--list-base`). 목록은 화면 위에 뜬 시트(2026-11-21, `position: fixed`, 위가 둥근 모서리 옆으로 그래프가 비쳐 보임, 그래프 칸은 화면 끝까지 + 아래 여백 `--list-h`). 시트는 세 자리 접힘(손잡이만 보임)·중간(`--list-base`)·펼침(88%)에 멈춤: 손잡이(`ListGrip.tsx`)를 끌면 따라오고, 놓으면 가까운 자리로, 빨리 툭 밀면(0.4px/ms 이상) 그 방향 다음 자리로, 누르면 접힘→중간·중간→펼침·펼침→중간. 높이 변화는 CSS transition으로 스르륵(끄는 동안은 `.app.sheet-dragging`으로 끔), 손잡이를 뗀 직후의 클릭은 버려서 아래 기기 줄이 눌리지 않게 함(계산은 `src/listHeight.ts`의 `sheetSnaps`/`releaseSnap`/`tapSnap`, 높이는 `.app`의 `--list-h`, 중간이면 CSS 기본값, 기억 안 함). 그래프 높이는 기본 목록 높이 `--list-base`로만 정해서 목록을 끌어도 그래프 크기는 그대로이고, 목록을 내리면 그래프 아래 툴바·안내가 드러남(사용자 요청). 헤드폰/이어폰은 목록 맨 위 `[헤드폰 | 이어폰]`으로 바꿈. 폰에서만 보이는 부품은 `.mobile-only`. 목록 폭 조절은 폰에서 숨김. 그래프 칸은 펼친 목록과 겹치지 않게 칸 안에서 스크롤. 그래프 칸 안 순서는 CSS `order`로 탭 → 범례 → 그래프(높이 `max(160px, 100dvh − --list-base − 140px)`로 화면 높이에 맞춤, 차이 그래프는 그 60%) → 툴바 → 경고·안내(툴바는 아래로 밀어서 봄). EQ 화면은 한 칸으로: 저장한 EQ 목록은 가로 스크롤, 기기·목표 선택 상자는 폭 전체, 밴드 표는 숫자 칸을 줄이고 게인 슬라이더 폭을 화면 폭으로 계산. 팝업들은 원래 폭 `min(640px, 100vw − 32px)`라 그대로 맞음. 설계는 `docs/superpowers/specs/2026-11-20-mobile-layout-design.md`.

다크/라이트 모드: CSS 변수로 색을 정의하고 시스템 설정 또는 버튼으로 전환. 메뉴의 테마 버튼(해/달)은 지금 보이는 테마의 반대로 바로 바꾸고, "시스템 설정 따르기"는 설정 팝업에서 고른다. 설정 버튼은 톱니바퀴. 다크 색은 `@media (prefers-color-scheme: dark)` 안(`:root:not([data-theme=light])`)과 `:root[data-theme=dark]` 두 곳에 같은 값으로 적는다. 그래프처럼 색을 직접 읽는 화면은 `useResolvedTheme()`으로 테마 변화를 구독한다.

화면 글은 짧게(2026-11-20 테스터 피드백 "글자가 너무 많다"): 화면에는 꼭 필요한 라벨·짧은 경고만 두고, 설명은 `Help.tsx`("ⓘ 도움말" `<details>` 접기) 안에 넣는다. 경고 상세는 `title`(마우스를 올리면 보임)로. 안드로이드 앱에서는 EQ 내보내기를 접어 둠. 적용 화면: EQ 화면, EQ로 들어보기, 기기 상세, 설정, 비슷한 기기 찾기, 기기 추가. 문구는 "~했어요"체로 짧게. 설정은 보통 앱 설정처럼 한 줄 항목 목록(`.settings-row`): 화면 테마 → 데이터(백업 내보내기·가져오기 ›) → 고급(접힘: 저장된 기기 정리, 저장 공간 보존[웹만]) → 맨 아래 버전, 도움말 링크 없음.

디자인(2026-11-20, 테스터 "네모네모하고 딱딱하다" → 삼성 One UI 느낌): `index.css` 맨 끝 "One UI 느낌 테마" 층이 앞 규칙을 덮어씀(빼면 예전 모양). 글꼴 Pretendard(`pretendard` 패키지 dynamic subset, `main.tsx`에서 불러옴, OFL). 값: `--radius-sm/md/lg/xl`(10/14/22/28px), `--field`(입력칸·버튼 바탕, 테두리 대신), `--shadow`/`--shadow-lg`, 바탕 `--bg` 연회색(다크는 거의 검정)·카드 흰색. 버튼은 테두리 없는 알약(카드형 버튼 `.eq-item` 등은 둥근 사각형), 입력칸·선택 상자는 면 + 꺾쇠 아이콘, 슬라이더·세그먼트(고른 칸이 떠오르는 알약)·팝업(28px, 폰은 아래쪽에 붙음)·비교 탭(알약)·그래프 카드·폰 아래 목록 시트(위가 둥근 카드) 다듬음. 그래프 색 팔레트는 그대로. ui-ux-pro-max 점검 반영: 글자 대비 4.5:1 이상(라이트 `--muted` #6b6676·`--accent` #1c68c9, 강조색 위 글자 `--on-accent` 라이트 흰색/다크 어두운색), 누를 때 `:active` 어두워짐, 마우스를 올렸을 때(`:hover`) 효과는 모두 `@media (hover: hover)` 안에만(폰은 탭한 뒤 hover가 남아 버튼이 밝게 굳어 보였음, 2026-11-21), 안드로이드 기본 탭 강조(누른 곳에 파란 네모)는 `-webkit-tap-highlight-color: transparent`로 끔, 켜진 버튼(토글 `.on`·세그먼트 `.active`·`.eq-item.active`)은 hover 때도 자기 바탕 유지, 애니메이션(2026-11-21, `index.css` 끝 "애니메이션" 묶음): 팝업은 열 때 떠오르고 닫을 때 가라앉음(`Modal.tsx`가 `.closing`을 붙이고 0.18초 뒤 닫음, 닫히는 동안 마지막 내용 유지, Esc·뒤로 가기는 `cancel` 신호로 받아 애니메이션을 거침, 팝업 바깥을 누르면 닫힘), 버튼은 누를 때 97%로 작아짐(목록 줄·손잡이·구역 제목·EQ 카드는 제외), 색 바뀜 0.18초, 구역 접기 꺾쇠 회전, 도움말 펼침·화면 전환 페이드, 비교 탭을 바꾸면 그래프 칸 내용(탭 줄 빼고)이 옆으로 밀려 들어옴(오른쪽 탭이면 오른쪽에서, `ComparePanel.tsx`의 `useTabSwitchAnimation`, 각 부품에 `element.animate()`: 폰의 CSS `order` 배치를 깨지 않게 감싸는 상자를 쓰지 않음. 누른 순간이 아니라 새 탭 데이터가 그려진 순간(`tab.id`)에 움직임), 필터 칸은 늘 그려 두고 `.collapse`(grid 줄 0fr↔1fr + `inert`)로 펼치고 접음, 그래프(`FrChart.tsx`)는 Chart.js 애니메이션 0.45초(새 곡선은 아래에서 올라오고 값이 바뀐 곡선은 새 자리로, 곡선마다 같은 dataset 객체를 이름+순서 열쇠로 계속 써서 곡선을 빼도 다른 곡선이 밀려 움직이지 않음, 마우스 반응은 즉시), 키보드 `:focus-visible` 테두리, 손가락 화면(`pointer: coarse`)만 누르는 영역 44~48px(목록 줄 안 ☆·⋯는 44×40), PC(`pointer: fine`)는 촘촘하게(최소 24px), `prefers-reduced-motion`이면 전환 효과 끔. 아이콘은 모두 `Icons.tsx`의 SVG(선 굵기 1.8, 메뉴 아이콘과 같은 계열: StarIcon·CloseIcon·MoreIcon·PlusIcon·ChevronDown/RightIcon·ArrowUpIcon·InfoIcon·AlertIcon, 글자 옆은 `.icon`). 글자 기호(☆★ ✕ ⋯ ▾ ↑ + ⓘ ⚠ ›)는 쓰지 않음(선택 상자 `<option>` 안의 "+ CSV 불러오기…"만 예외: option에는 그림을 못 넣음).

켜고 끄는 선택은 체크박스 대신 `ToggleButton`(켜지면 버튼 전체가 강조색으로 칠해짐), 여러 개 중 하나 고르기는 `SegmentedGroup`(`.segmented` 묶음, 고른 버튼에 `className="active"`. 떠오른 알약 하나(`::before`)가 고른 칸으로 미끄러짐, 위치는 `--seg-x/-w/-y/-h`)을 쓴다. 선택 상자는 `<select>` 대신 `Select.tsx`(쓰는 법은 `<select>`와 같음: value·onChange(`e.target.value`)·option/optgroup. PC는 기본 `<select>`, 손가락 화면은 앱 모양의 아래 시트에 체크 표시, 시트는 `createPortal`로 body 끝에)를 쓴다(2026-11-21, 안드로이드 기본 목록이 하얗고 네모나서 어색). 확인 창도 브라우저 기본 `confirm()` 대신 `src/confirm.ts`의 `await askConfirm({ title, message, ok, danger })`(App의 `ConfirmHost.tsx`가 앱 모양 팝업으로 그림, [취소]/[확인], 지우기는 `danger`로 빨간 버튼). `alert`·`prompt`도 쓰지 않는다.

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
- 결정(2026-10-24): 웹앱(PWA)으로 유지하고, 실제 EQ 적용은 계속 외부 EQ 앱(Equalizer APO, Wavelet)으로 내보내서 한다. → 2026-11-20 안드로이드는 바뀜: Capacitor 앱 안에서 직접 폰 전체 EQ(기술 스택의 "안드로이드 앱" 참고). PC는 여전히 내보내기. 데스크톱 앱 전환(Tauri/Electron)은 하지 않음. 이유: 기기 전체 EQ는 OS마다 네이티브 오디오 코드(Windows는 가상 오디오 장치·드라이버, Android는 Kotlin AudioEffect)를 따로 짜야 해서 부담이 너무 크고, iPhone은 어떤 앱이든 다른 앱 소리를 바꿀 수 없음. Electron은 모바일 미지원, Tauri 2는 모바일 앱은 되지만 전체 EQ는 결국 네이티브 코드가 필요. 앱 안 플레이어(Web Audio API로 내 음악 파일 재생)는 나중에 필요해지면 검토.
- 안드로이드 자체 EQ 시험(2026-11-20): 사용자가 "EQ 앱을 따로 켜는 게 귀찮다"고 해서 2026-10-24 결정을 다시 검토. `android-spike/`(Kotlin, 버튼 몇 개짜리 시험 앱)를 GitHub Actions(`.github/workflows/android-spike.yml`)로 빌드해 Releases `eq-spike`에 APK로 올림(작업 환경에서 dl.google.com이 막혀 안드로이드 SDK를 못 받음, Kotlin 타입 검사만 Robolectric `android-all` jar로 로컬에서 함). 안드로이드 기본 효과 DynamicsProcessing(API 28+)으로 ① 전체 출력(세션 0) ② 재생 앱의 오디오 세션 열림 신호(`ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION`) 두 방식을 시험 → 갤럭시 폴드7·안드로이드 17에서 **둘 다 스포티파이 소리에 EQ가 걸림**. 추가 시험(v0.2): 실제 앱 방식의 127밴드(Wavelet 주파수, 밴드 끝 = 이웃 주파수의 기하 평균)도 잡음 없이 걸리고, 0.3초마다 값만 바꿔 다시 걸어도 틱·끊김 없음. ② 세션 신호는 유튜브 뮤직·스포티파이가 보냄. 효과 객체는 포그라운드 서비스(`specialUse`)가 들고 있어야 화면을 닫아도 유지됨. 시험 전 Wavelet·삼성 이퀄라이저·Dolby Atmos 끄기, 삼성 "자동 차단" 끄고 APK 설치. 시험 앱은 본 앱 3단계에서 삭제(git 기록에 남음)
- PC 쪽 참고: 사용자가 받아 본 "소리결"(아카라이브 @koss, 파이썬 Windows 프로그램)은 VB-CABLE 가상 장치로 소리를 돌려받아 scipy 피크 필터를 거는 방식(지연 수십 ms, APO 불필요). 붙여넣기는 APO `Filter N: ON PK Fc ...` 형식을 읽어 이 앱의 Equalizer APO 내보내기를 그대로 붙여 쓸 수 있음. 내부 서버(127.0.0.1:47321)는 CORS가 없어 웹앱에서 자동으로 보낼 수는 없음. 스포티파이는 Web API에 EQ 기능이 없어 EQ를 넘길 수 없음(앱 내 EQ는 6밴드 고정)
- 계산(`src/eq.ts`, 순수 함수): 목표 EQ = 들어볼 곡선 − 지금 곡선(1/3옥타브 스무딩, 300Hz~3kHz 평균 정규화). 부스트 최대 +6dB, 컷 최대 −12dB, 8kHz 위는 점점 덜 따라가 12kHz부터 0. 피크 필터(RBJ 쿡북 공식, 48kHz 기준)를 오차가 가장 큰 곳부터 최대 10개 놓고 좌표 하강으로 다듬음(Q ≤ 4). 프리앰프 = −(최대 부스트). 검증: HD 600 → HD 650/HD 800 S/LCD-2 오차 0.07~0.42dB.
- 내보내기(`src/eqExport.ts`): Equalizer APO(Windows, ParametricEQ "Preamp/Filter: ON PK" 형식), Wavelet(Android, AutoEq GraphicEQ 형식, 프리앰프 포함), 직접 입력(PEQ 값). OS를 userAgent로 감지해 기본 앱을 고르고 사용자가 바꿀 수 있음. iPhone은 기기 전체 EQ가 불가해 안내만. 파일 이름은 "기기 → 목표"(Wavelet은 파일 이름을 프로필 이름으로 보여줘서 앞에 `audio-gear-eq`를 붙이지 않음). 폰 브라우저가 파일 공유를 지원하면(`navigator.canShare`) "공유" 버튼으로 공유 메뉴를 열어 바로 다른 앱에 보냄. 안드로이드 EQ 자동 적용은 불가(2026-11-20 확인: Wavelet·RootlessJamesDSP 모두 외부에서 프리셋을 넣는 공개 방법이 없음) → 파일을 Wavelet 가져오기(Import)로 한 번 넣고 앱 안에서 고름
- EQ 화면(왼쪽 메뉴 "EQ", `EqPage.tsx`, 목록·메인 칸을 합쳐 넓게 씀): 지금 쓰는 기기(DB의 모든 측정치, 보유 먼저) + 목표(없음/기기 측정치/내 타깃/기본 타깃). 두 칸 옆 [다른 기기](2026-11-21, `CatalogPickDialog.tsx` + 순수 함수 `src/catalogPick.ts`)로 전체 기기 목록(AutoEQ + squig.link)을 검색해 고르면 그때 측정치를 받아 저장하고 그 칸에 넣음(목록에서 기기를 누를 때와 같은 `addFromCatalog`). 맞은편 칸의 측정자가 잰 측정치를 먼저 고르고("같은 측정자" 표시), 검색은 단어 앞부분이 맞는 기기 → 지금 기기와 같은 종류 순. "목표에 맞춰 자동 계산"으로 밴드를 채우고 `EqBandTable.tsx`에서 주파수·게인(슬라이더+숫자)·Q를 직접 고치거나 밴드 추가·삭제(최대 20개). 프리앰프는 `autoPreamp`로 자동. 그래프는 원래/EQ 적용 후/목표(위)와 만든 EQ/필요한 EQ(아래). EQ는 여러 개 저장(DB `eqPresets`, 백업 포함)해 목록에서 눌러 바꾸고, 새로 만들기·복제·삭제·이름 바꾸기. 목록(`EqPresetPicker.tsx`, PC는 왼쪽 칸, 폰은 맨 위 EQ 이름 버튼 → "EQ 고르기" 시트): 검색(EQ 이름·기기 이름) → 즐겨찾기(★, `EqPreset.favorite` 선택 필드, DB version 그대로) → 지금 쓰는 기기별 묶음, 묶음 안은 최근 수정 순, 폰에 적용 중 표시(`src/eqPresetList.ts`의 `groupPresets`). 중복 방지: 같은 "지금 기기 → 목표" 조합(`findSamePreset`, 목표 없는 EQ는 제외)이 있으면 EQ 화면에 "같은 조합의 EQ가 있어요 [열기]", "EQ로 들어보기"의 저장·폰에 적용은 새로 만들지 않고 있는 EQ를 씀. 고친 내용은 0.3초 멈추면 자동 저장(다른 EQ로 바꾸면 바로 저장). 고른 EQ id는 localStorage `eq.active`. 자동 계산 때 이름이 "새 EQ n"이면 "기기 → 목표"로 이름을 붙임. 웹앱은 다른 앱(스트리밍) 소리에 EQ를 걸 수 없어서 실제 적용은 EQ 앱으로 내보내서 한다. 내보내기 칸은 `EqExport.tsx`로 팝업과 공유.
- 화면: 그래프 툴바의 "EQ로 들어보기"(`EqDialog.tsx`). 지금 쓰는 기기 = 보유 기기 측정치(+비교 중), 들어볼 소리 = 비교 중인 측정치 또는 타깃. 측정자가 다르거나 카테고리가 다르면 경고. 복사(막히면 글 선택 후 Ctrl+C 안내)·파일로 저장. "EQ 목록에 저장"으로 `eqPresets`에 넣고(이름 "기기 → 목표", 목표는 `m:`/`t:`), 저장 후 "EQ 화면에서 열기"를 누르면 그 EQ가 골라진 채로 EQ 화면으로 이동(localStorage `eq.active`를 먼저 적고 화면 전환, 키는 `localPrefs.ts`의 `EQ_ACTIVE_KEY`).

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
- [x] PWA 적용과 배포 (2026-11-07 첫 배포, https://jindosz.github.io/audio-gear/ 에서 화면·기기 목록·서비스 워커 activated 확인) — PWA 완료(`vite-plugin-pwa`, 설정은 `vite.config.ts`, 아이콘은 `public/icon.svg` → `npx pwa-assets-generator`로 PNG 생성, `npm run build && npm run preview`로 확인, 주소는 http://localhost:4173/audio-gear/. 개발 서버에서는 서비스 워커가 동작하지 않음), 배포 완료(GitHub Pages, 위 기술 스택 참고). 앱 안 미리보기 창의 localhost에서는 서비스 워커 등록이 "unknown error"로 실패하지만 배포 사이트에서는 정상. 남은 확인: 폰에서 설치·오프라인 실행
- [x] 기기 주요 특징(유선/무선, 오픈/세미 오픈/밀폐, 코덱, ANC) 입력과 목록·추천 결과 태그 표시 (`labels.ts`의 `specTags`)
- [x] 특징 추정값: 헤드폰은 Claude가 확실히 아는 시리즈만 규칙으로(`src/data/headphoneHints.ts`, 키 = 이름 앞부분, 가장 긴 키가 이김, `{}`는 일부러 비움), 이어폰은 이름에 무선 단서(AirPods, Galaxy Buds, Sony WF-, TWS 등)가 있을 때만. 이어폰 "대부분 유선" 같은 기본값은 넣지 않음. 적용 범위: 헤드폰 3,037개 중 1,759개, 이어폰 260개(2026-10-24). 무작위 40개 점검과 확신이 덜한 6개 웹 확인에서 오류 없음

### 3단계 (나중에)
- [x] 두 곡선 차이로 PEQ 계산 → EQ 앱용 내보내기 ("EQ로 들어보기", 위 "EQ로 들어보기 설계" 참고)
- [x] 외부 공개 FR DB 추가 연동: squig.link (목록 약 4만 3천 개, 묶고 정리한 뒤 목록에 보이는 기기: 헤드폰 3,038·이어폰 10,043. 이름 앞 [IEMs] 같은 태그로 분류를 보정하고, AutoEQ에 없는 기기는 여러 사이트 분류의 다수결. 남은 것: 출처마다 이름 표기가 크게 다른 기기는 따로 보임, 예: "Moondrop x Crinacle Blessing2 Dusk" / "Moondrop Blessing 2 Dusk")
- [x] 측정치 기반 새 기기 추천(곡선 간 거리 계산) — "추천 기능 설계" 참고. 특징 필터 ✅(2026-11-21, 추천 팝업의 유선/무선·ANC·오픈/밀폐(헤드폰 기준만). 기기 목록 필터와 같은 규칙·부품(`ListFilterBar.tsx`의 `SpecFilterFields`, `recommend.ts`의 `candidateMatches`), 묶음마다 15개로 자르기 전에 거름). 남은 선택 항목: Harman 선호도 점수
- [ ] FR에서 성향 지표 자동 추출(저음 셸프 양, 3kHz 대역, 5~8kHz 피크 등)과 태그 — 추천 계산기의 성향 지표와 같이 만든다
- [ ] 듣는 노래 기반 추천: 데이터 출처와 근거가 약해 실험 기능으로 보류. 장르 태그를 직접 고르는 가벼운 버전부터 검토
  - Spotify Web API(2026-10-24 검토): PKCE로 서버 없이 최근·많이 들은 곡은 받을 수 있지만, 음원은 DRM으로 분석 불가, audio-features는 2024-11부터 새 앱에 막힘, 장르는 아티스트 단위라 부정확 → 보류 유지
- [ ] 곡 분석 기반 자동 톤 조절 + Equalizer APO 자동 적용 (사용자 명세서 V2 검토, 2026-10-25, 아직 안 만듦)
  - 흐름: Last.fm `user.getRecentTracks`로 지금 곡 감지 → 제목 정리·커버/라이브 등은 제외 목록 → iTunes Search API로 30초 미리듣기(.m4a) 받아 대역 에너지·Crest Factor 분석 → 문제 있을 때만 필터 3개(5.5kHz 피로도 컷, 250Hz 중저역 컷, 105Hz 로우 셸프 부스트) → Layer 1(헤드폰 보정 = 이 앱의 EQ 프리셋) + Layer 2(곡별 필터)를 합쳐 APO가 `Include`하는 파일을 File System Access API로 덮어씀. 캐시·제외 목록은 DB에
  - 확인됨: iTunes 검색·미리듣기 음원·noembed 모두 CORS 허용(`Access-Control-Allow-Origin: *`). 선형 파워 합산 방식은 맞음. V1의 "핑크 노이즈로 평탄화"는 곡의 의도를 깎아서 버림
  - 위험(먼저 실험): ① APO 설정 폴더가 `C:\Program Files\...`라 관리자 권한·Chrome 시스템 폴더 차단 → `Include: <사용자 폴더 절대 경로>`로 우회하고 그 파일을 고쳐도 APO가 자동으로 다시 읽는지 확인 ② 파일 핸들은 IndexedDB에 저장되지만 브라우저를 다시 열면 권한 재허용 클릭이 필요할 수 있음 ③ 뒤에 있는 탭은 타이머가 늦어지고 Last.fm 반영도 몇 초 걸려 곡 바뀐 뒤 수 초~수십 초 늦게 적용
  - **보류(2026-11-20)**: APO가 이 PC에서 동작하지 않는 문제가 풀릴 때까지 미룸. 폰에서는 Wavelet으로 EQ가 걸리는 것을 확인함
  - 실험 결과(2026-10-30, 미해결): 사용자 PC에 APO 1.4.2가 `C:\Program Files\EqualizerAPO`에 설치되어 있고, `config.txt`는 `Include: C:\Users\dojin\Documents\audio-gear\web_auto_eq.txt` 한 줄. Editor는 Include 파일의 `Preamp: -60 dB`를 읽어 Peak gain −60dB로 계산함(설정·Include 정상). 그런데 실제로 듣는 Fosi Audio ZH3(기본 장치, Device Selector에 "APO is already installed")에서 스포티파이·유튜브 소리가 그대로 → APO가 실제 소리 경로에서 동작하지 않음. 해 본 것: 공간 음향 끄기, 오디오 향상 = 장치 기본 효과, Device Selector Troubleshooting에서 Auto 끄고 설치 방식 변경 + 재부팅 → 모두 변화 없음. 원인 모름(Windows Insider 빌드 26300과 APO 1.4.2 호환 문제일 수도 있으나 추측). 원격(Sunshine 스트리밍)으로 들을 때는 APO 효과가 안 실릴 수 있어 판정에 쓰지 않음. Device Selector는 그냥 실행하면 Qt 플러그인 오류 → `$env:QT_PLUGIN_PATH = "C:\Program Files\EqualizerAPO\qt"` 후 실행. 다음에 할 수 있는 것: 출력을 K66으로 바꿔 같은 시험(ZH3 문제인지 PC 전체 문제인지 구분), Device Selector에서 ZH3 Auto를 다시 켜 원래대로. 이 문제가 풀리기 전에는 앱의 Equalizer APO 내보내기도 이 PC에서는 소리를 못 바꿈
  - 수식 보정 필요: 대역 폭이 서로 달라(기준 500Hz~2kHz = 2옥타브, 치찰음 4.5~7.5kHz ≈ 0.7옥타브, 중저역 220~320Hz ≈ 0.5옥타브) 옥타브당 에너지로 나눠야 비교가 됨. 참고 코드는 기준을 `freq1000` 하나로 써서 설명과 다름. 임계치(−2/+3.5/−4dB)는 근거가 없어 장르가 다른 곡 20~30개로 실제 값을 보고 정함
  - 이 앱에 필요한 것: `eq.ts`에 로우 셸프 필터, 곡 감지(Last.fm API 키), 분석기, 캐시·제외 목록(DB 새 version), APO 파일 연결. 다시 쓸 것: EQ 프리셋, `autoPreamp`, `eqExport.ts`의 APO 형식
  - 제외: 하드웨어 DAC 직접 제어(WebHID/WebUSB, 제품마다 비공개 프로토콜). 플레이리스트 평균 프리셋(Android용)은 나중에 가능
  - 순서: 1) APO `Include` + 파일 덮어쓰기 실험(코드 거의 없이) 2) 곡 분석기와 성향 그래프만 만들어 실제 곡으로 임계치 맞추기 3) Last.fm 연동과 자동 적용
- [ ] 청력 측정 EQ: 브라우저에서 내 귀의 주파수별 역치를 재서 보정 EQ 만들기 (2026-10-24 검토, 2026-11-20 Gemini 명세서와 함께 재검토 → **`docs/superpowers/specs/2026-11-20-hearing-eq-review.md`가 최신**: 정상 역치 곡선 빼기, 헤드폰은 타깃 편차만 빼기, 블루투스 무음 처리 주의, 좌·우 음량 차이부터, "내 귀 보정" 층으로 다른 EQ 위에 더하기. 아직 안 만듦)
  - 방식: Web Audio API 순음(125Hz~12kHz, 좌·우 따로)을 계단법(들리면 줄이고 안 들리면 키움)으로 겨우 들리는 크기(역치)를 찾고, 1kHz 기준 상대값으로 계산
  - 한계: 브라우저는 실제 음압(dB SPL)을 모르니 상대값만 쓴다(좌·우 차이 확인에는 충분). 결과에는 그 헤드폰의 FR이 섞여 있어 그 헤드폰 전용이고, 기기 FR 보정 EQ와 같이 걸면 이중 보정이 될 수 있음
  - 보정: 역치 차이를 다 올리지 않고 절반 정도만(등청감 특성상 평소 음량에서는 차이가 작게 느껴짐), 기존 EQ 규칙(부스트 최대 +6dB, 12kHz 위는 0) 적용. 14~16kHz 위의 나이에 따른 저하는 보정하지 않음
  - 안전: 아주 작은 소리에서 시작, 최대 음량 제한, "의료용 검사가 아님"·조용한 곳·볼륨 고정·블루투스 음향 효과 끄기 안내
  - 연결: 결과를 `FrCurve`로 저장해 "내 귀 보정" 타깃이나 EQ 프리셋(`eqPresets`)으로 쓰고, 계산은 `eq.ts`, 내보내기는 기존 형식 재사용. 서버·외부 API 불필요
- [ ] 안드로이드 앱: 고른 앱에만 EQ 걸기(2026-11-20 "나중에"로 미룸). 재생 앱의 오디오 세션 신호(② 방식)에 앱 이름이 와서 [모든 앱 | 고른 앱만] 설정으로 가능. 신호를 보내는 앱만 됨(스포티파이 확인, 유튜브 등은 안 보낼 수 있음 → 시험 앱 ②로 앱별 확인)
- [ ] 소스 출력 임피던스에 따른 FR 변화 시뮬레이션, PC↔폰 동기화

## 다음 작업

(2026-11-21 기준. 지난 채팅 요약은 `docs/handoff-2026-11-20.md`. APO 관련 일은 보류. 안드로이드 앱 3단계 폰 확인(자동 반영·EQ로 들어보기 적용·재부팅 복원·뒤로 가기·알림 거절·화면 끈 채 30분 유지) 모두 통과, Releases `eq-spike` 삭제 완료 → 배터리 최적화 제외 요청은 필요 없음)

1. 배포 사이트로 옮기기: localhost 데이터를 JSON 백업으로 옮기고, 폰에서 PWA 설치·오프라인 실행 확인
2. (선택) Harman 선호도 점수, 청력 측정 EQ
