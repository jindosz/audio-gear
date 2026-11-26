// 웹 아이콘 PNG 생성 설정. 순서는 scripts/icons.cjs 맨 위 설명 참고(maskable·애플 아이콘은 그 스크립트가 꽉 찬 그림으로 다시 만든다).
import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// 안드로이드 "maskable" 아이콘과 iOS 홈 화면 아이콘은 기기가 모양을 직접 자른다(원, 둥근 사각형 등).
// 빈 곳이 흰색이면 어색해서 아이콘 그라데이션 가운데쯤 파란색으로 채운다.
const background = '#2565c4'

export default defineConfig({
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions: { background } },
    apple: { ...preset.apple, resizeOptions: { background } },
  },
  images: ['public/icon.svg'],
})
