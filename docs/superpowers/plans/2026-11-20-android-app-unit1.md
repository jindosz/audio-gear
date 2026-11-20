# 안드로이드 앱 1단계(웹앱을 폰 앱으로) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지금 웹앱을 Capacitor로 감싼 안드로이드 앱(APK)이 GitHub Actions에서 고정 서명으로 빌드되어 Releases에 올라가고, 폰에서 설치해 기존 기능(목록·그래프·EQ 화면·백업)이 동작한다. 폰 전체 EQ는 2단계.

**Architecture:** Vite에 `capacitor` 모드를 더해 상대 경로·서비스 워커 없는 빌드를 만들고 `npx cap sync android`로 `android/`(Capacitor 표준 프로젝트, 저장소에 커밋)에 넣는다. CI가 Secrets의 키스토어로 `assembleRelease`를 서명한다. WebView에서 안 되는 파일 내려받기·공유는 `src/platform.ts` 한 곳에서 안드로이드면 `@capacitor/filesystem` + `@capacitor/share`로 바꾼다.

**Tech Stack:** Capacitor 8.6(`@capacitor/core`·`cli`·`android` 8.6.2, `@capacitor/filesystem` 8.1, `@capacitor/share` 8.0), AGP 8.13·Gradle 8.14.3(Capacitor 템플릿 그대로), JDK 21, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-20-android-eq-app-design.md`(이 계획은 "작업 단위" 1번. 2·3번은 1단계를 폰에서 확인한 뒤 따로 계획)

## Global Constraints
- 앱 id `io.github.jindosz.audiogear`, 앱 이름 `audio-gear`.
- 배포 사이트(GitHub Pages) 빌드는 바뀌지 않는다: `npm run build`의 `base`는 `/audio-gear/`, `dist/sw.js` 생성 유지.
- 안드로이드 빌드: `base: './'`, PWA(서비스 워커) 끔.
- 키스토어는 CI 안에서 만들지 않는다. Secrets 이름: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
- APK는 Releases 태그 `android-latest`, 파일 이름 `audio-gear.apk`. `versionCode` = CI 실행 번호.
- 주석·화면 글자는 한국어. 확인 명령: `npx tsc -b`, `npm run lint`, `npm run build`.
- 이 단계에서는 테스트 실행기(vitest)를 넣지 않는다(순수 계산이 없음). 2단계의 변환 함수에서 추가.

## Review Focus
- 상태 표시줄·내비게이션 바와 화면이 겹치는지: `index.html`이 `viewport-fit=cover`를 쓰지 않으므로 Capacitor 기본(`SystemBars.insetsHandling: 'native'`)이 WebView에 여백을 준다 → Task 4 폰 확인 항목.
- 업데이트 설치 시 데이터 유지: 같은 키로 서명한 새 APK가 덮어쓰기 설치되고 기기·EQ 목록이 남는지 → Task 4 폰 확인 항목(두 번째 빌드로).
- 앱 안에서 외부 데이터 받기: AutoEQ·squig.link 목록이 WebView(`https://localhost`)에서도 받아지는지 → Task 4 폰 확인 항목.
- 백업 가져오기(`<input type=file>`)가 앱 안에서 파일 선택 창을 여는지 → Task 4 폰 확인 항목.
- 웹(배포 사이트)의 "파일로 저장"·"공유"·백업 내보내기가 전과 똑같은지 → Task 2 Playwright 확인.

---

### Task 1: Capacitor 껍데기와 안드로이드 빌드 모드

**Files:**
- Modify: `package.json`(의존성, 스크립트 `build:android`), `vite.config.ts`, `.gitignore`
- Create: `capacitor.config.ts`, `android/`(`npx cap add android`가 만드는 전체), `assets/icon.png`(아이콘 원본)

**Interfaces:**
- Produces: `npm run build:android` = `tsc -b && vite build --mode capacitor && cap sync android`. 산출물 `dist/`(상대 경로) → `android/app/src/main/assets/public/`.

- [ ] **Step 1:** 의존성 추가: `@capacitor/core@^8.6.2`, `@capacitor/android@^8.6.2`, `@capacitor/filesystem@^8.1.5`, `@capacitor/share@^8.0.3`(dependencies), `@capacitor/cli@^8.6.2`(devDependencies).
- [ ] **Step 2:** `capacitor.config.ts`: `appId: 'io.github.jindosz.audiogear'`, `appName: 'audio-gear'`, `webDir: 'dist'`. 그 밖은 기본값.
- [ ] **Step 3:** `vite.config.ts`: 함수 인자에 `mode` 추가. `mode === 'capacitor'`면 `base: './'`이고 `VitePWA`를 plugins에서 뺀다. 그 밖은 지금 그대로.
- [ ] **Step 4:** `npx cap add android` 실행(SDK 없이 템플릿만 복사됨). `.gitignore`에 Capacitor 템플릿이 만든 `android/.gitignore`가 빌드 산출물을 이미 빼는지 확인하고, 루트 `.gitignore`에 `*.jks`, `*.keystore` 추가.
- [ ] **Step 5:** 앱 아이콘: `public/pwa-512x512.png`를 `assets/icon.png`로 복사 → `npx @capacitor/assets generate --android --iconBackgroundColor '#1b1b1d'`(실행만, 의존성에 넣지 않음)로 `android/app/src/main/res/mipmap-*` 생성.
- [ ] **Step 6: 확인**
  Run: `npm run build:android && grep -c 'src="./' dist/index.html && test ! -f dist/sw.js && echo OK-cap`
  Expected: 숫자 1 이상과 `OK-cap`.
  Run: `npm run build && grep -c '/audio-gear/' dist/index.html && test -f dist/sw.js && echo OK-web`
  Expected: 숫자 1 이상과 `OK-web`.
  Run: `npx tsc -b && npm run lint`
  Expected: 오류 0.
- [ ] **Step 7: 커밋** `안드로이드 앱 껍데기(Capacitor) 추가, 안드로이드용 빌드 모드`

### Task 2: 파일 저장·공유를 플랫폼 창구로

**Files:**
- Create: `src/platform.ts`
- Modify: `src/components/SettingsDialog.tsx`(백업 내보내기), `src/components/EqExport.tsx`(파일로 저장·공유)

**Interfaces:**
- Produces:
  - `isAndroidApp(): boolean` — `Capacitor.getPlatform() === 'android'`
  - `saveTextFile(fileName: string, text: string, mime: string): Promise<void>` — 웹: 지금의 Blob + `<a download>`. 안드로이드: `Filesystem.writeFile({ path: fileName, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })` → 받은 `uri`로 `Share.share({ title: fileName, files: [uri] })`. 사용자가 공유 창을 닫은 것은 오류로 보지 않는다.
- Consumes: Task 1의 의존성.

- [ ] **Step 1:** `src/platform.ts`에 위 두 함수.
- [ ] **Step 2:** `SettingsDialog.tsx`의 `handleExport`가 `saveTextFile(backupFileName(), JSON.stringify(data), 'application/json')`를 쓰게 바꾼다. 안내 문구는 안드로이드면 "공유 창에서 저장할 곳(내 파일, 드라이브 등)을 고르세요"를 덧붙인다.
- [ ] **Step 3:** `EqExport.tsx`: "파일로 저장"은 `saveTextFile(fileName, text, 'text/plain')`. 안드로이드 앱에서는 "공유" 버튼을 숨긴다("파일로 저장"이 이미 공유 창을 열므로). 웹은 지금 그대로(`canShareFiles`일 때 공유 버튼).
- [ ] **Step 4: 확인(웹 동작 유지)**
  Run: `npx tsc -b && npm run lint`
  Expected: 오류 0.
  Playwright(Pixel 7, 개발 서버): 설정 → 백업 내보내기를 누르면 `download` 이벤트가 오고 파일 이름이 `backupFileName()` 형식. "EQ로 들어보기" → "파일로 저장"도 `download` 이벤트, 파일 이름 `Denon AH-D600 → Sennheiser HD 650.txt`(Wavelet 형식일 때).
- [ ] **Step 5: 커밋** `파일 저장·공유를 플랫폼 창구(platform.ts)로, 안드로이드 앱은 공유 창으로`

### Task 3: 서명 고정과 APK 자동 빌드

**Files:**
- Modify: `android/app/build.gradle`(서명·버전)
- Create: `.github/workflows/android.yml`, `docs/android-install.md`(사용자용 설치·키 등록 안내)

**Interfaces:**
- Consumes: `npm run build:android`(Task 1).
- Produces: Releases `android-latest`의 `audio-gear.apk`.

- [ ] **Step 1:** `android/app/build.gradle`: `defaultConfig`의 `versionCode`는 환경 변수 `VERSION_CODE`(없으면 1), `versionName`은 `"0.1." + versionCode`. `signingConfigs.release`는 환경 변수 `ANDROID_KEYSTORE_PATH`·`ANDROID_KEYSTORE_PASSWORD`·`ANDROID_KEY_ALIAS`·`ANDROID_KEY_PASSWORD`가 모두 있을 때만 만들고 `buildTypes.release`에 연결(없으면 서명 없이 빌드되어 로컬 확인용).
- [ ] **Step 2:** `.github/workflows/android.yml`: `push`(branches: main, paths: `src/**`, `android/**`, `public/**`, `index.html`, `package*.json`, `vite.config.ts`, `capacitor.config.ts`, 이 파일) + `workflow_dispatch`. permissions `contents: write`. 순서: checkout → setup-node 24(cache npm) → `npm ci` → `npm run build:android` → setup-java temurin 21 → `gradle/actions/setup-gradle@v4` → Secrets 4개 중 하나라도 없으면 "키스토어 Secrets가 없습니다" 출력 후 실패 → `ANDROID_KEYSTORE_BASE64`를 `$RUNNER_TEMP/release.jks`로 디코드 → `android/`에서 `./gradlew assembleRelease`(env: `VERSION_CODE=${{ github.run_number }}`와 서명 변수) → `app/build/outputs/apk/release/app-release.apk`를 `audio-gear.apk`로 → `softprops/action-gh-release@v2`(tag `android-latest`, `target_commitish: ${{ github.sha }}`, `prerelease: false`, 본문에 커밋·버전).
- [ ] **Step 3:** 키스토어 만들기(Claude 작업 환경, 저장소 밖 scratchpad):
  `keytool -genkeypair -keystore audio-gear-release.jks -storetype PKCS12 -alias audio-gear -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=audio-gear" -storepass <무작위 24자> -keypass <같은 값>`
  → `.jks` 파일과, Secrets 4개 값(`base64 -w0`한 키스토어, 비밀번호 2개, 별칭 `audio-gear`)을 적은 텍스트 파일을 사용자에게 파일로 보낸다(채팅 본문에 비밀번호를 쓰지 않는다).
- [ ] **Step 4:** `docs/android-install.md`: ① GitHub 저장소 Settings → Secrets and variables → Actions → New repository secret으로 4개 등록 ② 키스토어·비밀번호는 PC에 보관(잃으면 업데이트 때 앱을 지워야 함) ③ 폰: 삼성 자동 차단 끄기, Wavelet·삼성 이퀄라이저·Dolby Atmos 끄기, Releases `android-latest`에서 APK 받아 설치 ④ 배포 사이트 → 설정 → 백업 내보내기 → 앱 → 설정 → 가져오기로 데이터 옮기기.
- [ ] **Step 5: 확인(사용자가 Secrets 등록 후)**
  작업 브랜치에서 `workflow_dispatch`로 실행(GitHub MCP `actions_run_trigger`, ref = 작업 브랜치).
  Expected: 실행 성공, Releases `android-latest`에 `audio-gear.apk`.
- [ ] **Step 6: 커밋** `안드로이드 APK 자동 빌드(고정 서명)와 설치 안내`

### Task 4: 폰에서 확인하고 정리

**Files:**
- Modify: `CLAUDE.md`(기술 스택·아키텍처 결정에 안드로이드 앱 1단계 기록, "다음 작업" 갱신)

- [ ] **Step 1: 사용자 폰 확인 목록**(사용자에게 하나씩 결과를 받는다)
  1. APK 설치 후 앱이 열리고, 상태 표시줄·아래 내비게이션 바와 화면이 겹치지 않는다.
  2. 헤드폰 목록(AutoEQ·squig.link)이 받아지고 기기를 누르면 그래프가 그려진다.
  3. 설정 → 백업 가져오기에서 파일 선택 창이 열리고, 배포 사이트에서 내보낸 백업이 들어간다.
  4. 설정 → 백업 내보내기, EQ "파일로 저장"이 공유 창을 연다.
  5. CI를 한 번 더 돌린 새 APK를 지우지 않고 설치했을 때 덮어쓰기가 되고 데이터가 남는다.
- [ ] **Step 2:** 문제가 나오면 원인을 찾아 고치고(각각 커밋) 1로 돌아간다.
- [ ] **Step 3:** CLAUDE.md 갱신 후 커밋 `CLAUDE.md: 안드로이드 앱 1단계 기록`, main 합치기는 사용자에게 묻는다.
