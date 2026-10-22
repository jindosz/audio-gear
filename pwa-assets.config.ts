// 앱 아이콘 PNG 생성 설정. public/icon.svg를 고친 뒤 `npx pwa-assets-generator`를 다시 실행하면 된다.
import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// 안드로이드 "maskable" 아이콘과 iOS 홈 화면 아이콘은 기기가 모양을 직접 자른다(원, 둥근 사각형 등).
// 빈 곳이 흰색이면 어색해서 아이콘과 같은 파란색으로 채운다.
const background = '#2a78d6'

export default defineConfig({
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions: { background } },
    apple: { ...preset.apple, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
})
