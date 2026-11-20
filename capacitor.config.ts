// 안드로이드 앱 설정(Capacitor). 웹앱 빌드 결과(dist)를 안드로이드 앱 안에 넣어 띄운다.
// Capacitor: 웹 코드를 그대로 안드로이드·iOS 앱으로 감싸 주는 도구
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.github.jindosz.audiogear',
  appName: 'audio-gear',
  webDir: 'dist',
  // 앱 안 웹 화면의 주소(출처). 기기·EQ 목록(IndexedDB)은 이 주소에 묶여 저장되므로,
  // 바꾸면 업데이트 뒤 데이터가 안 보인다. 절대 바꾸지 말 것(지금 값은 Capacitor 기본값과 같음)
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
  },
}

export default config
