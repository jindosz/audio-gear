# audio-gear 안드로이드 앱 설치 안내

## 1. 서명 키 등록 (처음 한 번, PC에서)
GitHub이 앱을 매번 같은 키로 서명해야 폰에서 지우지 않고 업데이트됩니다(데이터 유지).

1. Claude가 준 `github-secrets.txt`와 `audio-gear-release.jks`를 PC의 안전한 곳에 보관합니다. 잃어버리면 다음 업데이트 때 앱을 지우고 다시 깔아야 합니다. 다른 사람과 공유하지 마세요.
2. 브라우저에서 https://github.com/jindosz/audio-gear → **Settings** → 왼쪽 **Secrets and variables** → **Actions** → **New repository secret**.
3. `github-secrets.txt`에 적힌 4개를 하나씩 등록합니다. **Name**에는 `== Name: ... ==`의 이름을, **Secret**에는 그 아래 줄을 그대로 붙여넣습니다.
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_PASSWORD`
   - `ANDROID_KEYSTORE_BASE64` (아주 긴 한 줄 전체)

## 2. 폰 준비
- **설정 → 보안 및 개인정보 보호 → 자동 차단**을 끕니다(켜져 있으면 APK 설치가 막힘). 설치 후 다시 켜도 됩니다.
- 앱의 "폰에 적용"(폰 전체 EQ, 2단계에서 추가 예정)을 쓰기 시작하면, 다른 EQ와 겹치지 않게 **Wavelet**을 끄거나 지우고 삼성 사운드의 **이퀄라이저·Dolby Atmos**를 끕니다. 그 전까지는 지금처럼 EQ 파일을 Wavelet으로 가져와 씁니다.

## 3. 설치·업데이트
1. 폰 브라우저로 https://github.com/jindosz/audio-gear/releases/tag/android-latest 를 열고 `audio-gear.apk`를 받습니다.
2. 받은 파일을 열어 설치합니다. "출처를 알 수 없는 앱" 허용, Play 프로텍트 경고가 나오면 허용 / "그래도 설치".
3. 업데이트도 같은 방법입니다. 지우지 말고 그대로 설치하면 덮어써집니다.
- `android-preview`(미리 보기)는 main에 합치기 전 작업 브랜치의 시험 빌드입니다. Claude가 확인을 부탁할 때만 설치하세요.

## 4. 데이터 옮기기 (처음 한 번)
앱과 배포 사이트(https://jindosz.github.io/audio-gear/)는 저장소가 따로라, 기기·EQ 목록을 백업으로 옮깁니다.
1. 지금 쓰던 곳(PC 또는 폰 브라우저의 배포 사이트)에서 **설정(톱니바퀴) → 백업 내보내기**.
2. 그 파일을 폰으로 옮긴 뒤(카카오톡 나에게 보내기, 드라이브 등), 앱에서 **설정 → 가져오기**로 고릅니다.
