# 안드로이드 자체 EQ 앱 설계 (2026-11-20)

## 왜
- 사용자는 이 앱에서 만든 EQ를 폰(스트리밍, 주로 스포티파이)에 걸어 듣는다. 지금은 Wavelet용 파일로 저장 → Wavelet을 열어 가져오기를 해야 하고, 사용자는 "EQ 앱을 따로 켜는 게 귀찮다"고 했다.
- 시험 앱(`android-spike/`)으로 갤럭시 폴드7·안드로이드 17에서 안드로이드 기본 효과 **DynamicsProcessing**으로 폰 전체 소리에 EQ가 걸리는 것을 확인했다. ① 전체 출력(세션 0) ② 재생 앱의 오디오 세션 신호, 두 방식 모두 됨.
- 그래서 2026-10-24의 "웹앱 유지, EQ는 외부 앱" 결정을 안드로이드에 한해 바꾼다.

## 목표
- 지금 웹앱 전체(기기 목록·그래프·추천·EQ 화면)를 **안드로이드 앱 하나**로 쓰고, 앱 안에서 **"폰에 적용"**을 누르면 폰 전체 소리에 그 EQ가 바로 걸린다. Wavelet 같은 다른 앱이 필요 없다.
- 화면을 닫아도 EQ가 유지되고, 알림에서 끌 수 있다.
- 나중에 Windows로 넓힐 수 있게, 화면 코드는 플랫폼별 EQ 코드를 직접 부르지 않는다.

## 안 할 것(이번 범위 밖)
- Windows·iPhone 자체 EQ(Windows는 나중에 APO 또는 가상 케이블 방식으로 따로 설계)
- 헤드폰을 바꿔 연결하면 EQ 자동 전환, 앱별로 다른 EQ
- 플레이스토어 등록(APK 직접 설치만)
- PWA(배포 사이트)와 안드로이드 앱 사이 데이터 자동 동기화

## 실패로 볼 것
- 배포 사이트(PWA)·PC 화면이 깨지거나 기능이 줄어드는 것
- EQ가 켜진 상태에서 소리가 깨지거나(클리핑) 갑자기 매우 커지는 것
- 앱을 업데이트할 때마다 지우고 다시 깔아야 해서 데이터(기기·EQ 목록)가 날아가는 것

## 제약
- 사용자는 개발 입문 단계. Windows PC에 Android Studio를 깔지 않는다 → **APK는 GitHub Actions에서 빌드**해 저장소 Releases에 올리고, 폰 브라우저로 받아 설치한다.
- Claude 작업 환경은 dl.google.com이 막혀 안드로이드 SDK 빌드를 못 한다. Kotlin은 Robolectric `android-all` jar로 타입 검사만 로컬에서 하고, 실제 빌드는 CI.
- 저장소가 공개라 APK도 공개된다(개인 정보 없음).
- 사용자 폰: 갤럭시 폴드7, 안드로이드 17. minSdk 28(DynamicsProcessing이 API 28부터).
- 출력: 사용자는 **블루투스**로 듣고, 시험 앱도 블루투스로 확인했다. USB DAC 등 다른 출력은 확인하지 않았고 이번에 따로 다루지 않는다(효과를 건너뛰는 경로일 수 있음).
- 다른 EQ 앱: 이 앱이 완성되면 사용자는 Wavelet을 쓰지 않는다 → 다른 EQ 앱 감지·경고는 만들지 않고, 설치 안내에 "Wavelet 끄기(또는 삭제), 삼성 이퀄라이저·Dolby Atmos 끄기"를 적는다.
- 작은 단위로 나누고, 단위마다 확인 방법과 커밋을 제안한다(CLAUDE.md 작업 방식).

## 방식 비교(사용자가 A를 고름)
- **A. Capacitor로 웹앱 전체를 안드로이드 앱으로 감싸고, EQ만 Kotlin 플러그인** ← 선택. 앱 하나로 끝나서 "귀찮음"이 바로 풀린다. 화면 코드는 그대로 재사용.
- B. 웹앱은 그대로 두고 작은 "EQ 엔진 앱"을 따로 만들어 공유로 EQ를 받기. 데이터 이전이 필요 없지만 앱이 두 개라 귀찮음이 절반만 풀린다.
- C. Tauri 2로 안드로이드·Windows를 한 번에. Rust 도구가 필요하고 안드로이드 빌드가 더 복잡하며, 결국 EQ는 플랫폼별 코드라 공통으로 얻는 게 적다. Windows는 그때 껍데기(Tauri/Electron)를 따로 고른다.

## 구조

### 1. EQ 엔진 창구(`src/eqEngine.ts`)
화면은 이 파일의 함수만 부른다(`repo.ts`와 같은 생각). 플랫폼에 따라 구현을 고른다.

- `getEqEngine(): EqEngine`
- `EqEngine`
  - `kind: 'android' | 'none'`
  - `apply(settings: { name: string; filters: PeakFilter[]; preamp: number }): Promise<void>` — 폰 전체에 건다. 이미 켜져 있으면 바꾼다
  - `off(): Promise<void>`
  - `status(): Promise<{ on: boolean; name?: string; error?: string }>`
  - `onStatus(cb): () => void` — 알림에서 끈 경우처럼 앱 밖에서 바뀐 상태를 화면에 알린다
- `'none'`(일반 브라우저): 화면에 "폰에 적용" 버튼을 보이지 않는다. 지금처럼 내보내기만.
- 판별: Capacitor가 주는 `Capacitor.getPlatform() === 'android'`.

### 2. PEQ → DynamicsProcessing 변환(순수 함수, TypeScript)
DynamicsProcessing의 앞단 EQ(preEq)는 피크 필터가 아니라 "밴드 위쪽 끝 주파수 + 그 밴드 게인"을 여러 개 늘어놓는 방식이다(시험 앱 `EqService.kt`의 `EqBand(enabled, cutoff, gain)`). 그래서:
- 이 앱의 피크 필터들의 합 응답을 Wavelet과 같은 **127개 주파수**(`eqExport.ts`의 `GRAPHIC_EQ_FREQS`)에서 계산한다(`eq.ts`의 `totalResponse` 재사용).
- 밴드 i의 위쪽 끝 = i번째와 i+1번째 주파수의 기하 평균, 마지막 밴드는 20000Hz.
- 프리앰프는 DynamicsProcessing의 입력 게인(`setInputGainAllChannelsTo`)으로.
- 결과 `{ cutoffs: number[]; gains: number[]; inputGain: number }`를 Kotlin에 넘긴다. Kotlin은 계산하지 않고 받은 값만 건다(계산은 TS 한 곳에서, 테스트하기 쉽게).
- 안전: 각 밴드 게인을 +6dB / −24dB로 자르고, 입력 게인은 최대 0dB(올리지 않음).

### 3. 안드로이드 쪽(Kotlin, `android/`)
- Capacitor 표준 구조. 시험 앱의 코드를 옮겨 온다.
- **Capacitor 플러그인 `SystemEq`**: `apply({name, cutoffs, gains, inputGain})`, `off()`, `status()`, 상태 바뀜 이벤트.
- **포그라운드 서비스**(`specialUse`): DynamicsProcessing 객체를 들고 있어 화면을 닫아도 EQ 유지. 알림에 EQ 이름과 **"끄기"** 버튼.
- 방식: ① 전체 출력(세션 0)을 기본. 만들기에 실패하거나 제어권을 못 얻으면 ② 세션 신호 방식으로 자동 전환하고 상태에 표시.
- 마지막으로 건 EQ와 켜짐 여부를 SharedPreferences에 저장 → 폰을 다시 켜면(BOOT_COMPLETED) 서비스가 다시 건다.

### 4. 앱 화면
- EQ 화면(`EqPage.tsx`) 편집 칸 위: `[폰에 적용]` 버튼(`ToggleButton`)과 상태 한 줄("지금 폰에 적용 중: HD600 → HD650 · 끄기").
- 지금 적용 중인 EQ를 고치면(자동 저장과 같은 0.3초 멈춤 뒤) 폰에도 바로 다시 건다 → 들으면서 조정 가능.
- 다른 EQ를 "폰에 적용"하면 그것으로 바뀐다(동시에 하나만).
- "EQ로 들어보기" 팝업(`EqDialog.tsx`)에도 `[폰에 적용]`. 저장 안 한 EQ면 먼저 EQ 목록에 저장한 뒤 건다.
- 적용 중 EQ의 id는 앱 저장소(localStorage `eq.applied`)에 둔다.

### 5. 앱 안에서 안 되는 웹 기능 고치기
안드로이드 WebView는 `<a download>` 내려받기와 `navigator.share`를 지원하지 않는다.
- "파일로 저장"(EQ 내보내기), 설정의 **백업 내보내기** → 안드로이드 앱에서는 `@capacitor/filesystem`으로 저장 후 `@capacitor/share`로 공유 메뉴 열기. 웹에서는 지금 방식 그대로.
- 이 분기도 플랫폼 창구 한 곳(`src/platform.ts` 같은 파일의 `saveTextFile(name, text)`)으로 모은다.
- 백업 가져오기(`<input type=file>`)는 WebView에서 동작하므로 그대로.

### 6. 빌드·배포
- Vite에 `capacitor` 모드 추가: `base: './'`, PWA 플러그인(서비스 워커) 끔. 일반 빌드(배포 사이트)는 그대로 `/audio-gear/`.
- 새 GitHub Actions 작업: `npm ci` → `vite build --mode capacitor` → `npx cap sync android` → `./gradlew assembleRelease` → Releases **`android-latest`**에 `audio-gear.apk`로 올림. main에 푸시할 때와 손으로 실행할 때.
- **서명 고정**: 키스토어를 한 번 만들어 GitHub 저장소 Secrets에 넣고 CI가 그것으로 서명 → 덮어쓰기 업데이트 가능(데이터 유지). `versionCode`는 CI 실행 번호.
  - 만드는 곳(Claude 판단): 사용자 PC에 JDK(`keytool`)가 없을 수 있어 **Claude 작업 환경에서 `keytool`로 만들고** 파일로 사용자에게 전달 → 사용자가 GitHub 저장소 Settings → Secrets에 4개(`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`)를 붙여넣음. CI 안에서 만들지 않는다(공개 저장소라 로그·산출물이 공개됨). 키스토어를 잃으면 업데이트 때 앱을 지워야 하므로 사용자가 PC에 따로 보관한다
- 앱 이름 "audio-gear", 아이콘은 `public/pwa-512x512.png` 재사용.

### 7. 데이터
- 앱(WebView, 출처 `https://localhost`)과 배포 사이트는 저장소가 따로다. 처음 한 번 기존 JSON 백업 내보내기 → 앱에서 가져오기로 옮긴다. 자동 동기화는 범위 밖.
- 외부 데이터(AutoEQ raw.githubusercontent, squig.link)는 CORS를 허용하므로 앱 안에서도 그대로 받는다.

### 8. 시험 앱 정리
- 본 앱 1단계가 폰에서 확인되면 `android-spike/`, `android-spike.yml`, Releases `eq-spike`를 지운다.

## 확인되지 않은 것(먼저 폰에서 시험)
- 시험 앱은 밴드 3개만 썼다. **127밴드**(`VARIANT_FAVOR_FREQUENCY_RESOLUTION`)가 폴드7에서 잡음·끊김·발열 없이 되는지, EQ를 다시 걸 때(편집 중 0.3초마다) 소리가 튀지 않는지는 모른다 → 2단위 맨 앞에서 시험 앱을 고쳐 먼저 확인. 문제가 있으면 밴드를 줄이거나(예: 1/6옥타브 약 60개) 비슷한 게인의 이웃 밴드를 합친다(Claude 판단)
- 화면을 끈 채 오래 두었을 때 삼성이 포그라운드 서비스를 끄는지 → 3단위에서 확인. 꺼지면 "배터리 최적화 제외" 요청 화면을 앱에 넣는다(Claude 판단)

## 작업 단위(제안)
1. Capacitor로 지금 웹앱이 폰 앱으로 뜨기(EQ 없음) + CI APK 빌드·서명 고정 + 파일 저장/공유 고치기
2. PEQ → DynamicsProcessing 변환 함수(테스트 포함) + `SystemEq` 플러그인·서비스 + EQ 엔진 창구 + "폰에 적용" 버튼
3. 편집 중 바로 반영, "EQ로 들어보기"에서 적용, 재부팅 후 유지, 알림 "끄기", 시험 앱 정리

## 빌더에게 맡기는 것
- Capacitor·플러그인·Gradle 플러그인 버전(만들 때의 안정 버전)
- 테스트 도구: 지금 프로젝트에 테스트 실행기가 없음 → 순수 함수 테스트용으로 `vitest` 추가(Claude 판단)
- 알림·상태 문구, 버튼 위치의 세부
