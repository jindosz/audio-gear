// 안드로이드 앱 설정(Capacitor). 웹앱 빌드 결과(dist)를 안드로이드 앱 안에 넣어 띄운다.
// Capacitor: 웹 코드를 그대로 안드로이드·iOS 앱으로 감싸 주는 도구
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.github.jindosz.audiogear',
  appName: 'audio-gear',
  webDir: 'dist',
}

export default config
