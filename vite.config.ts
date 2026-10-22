import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PWA: 폰·PC에 앱처럼 설치하고, 한 번 연 뒤에는 인터넷 없이도 열리게 한다.
    // 빌드할 때 manifest(앱 이름·아이콘 정보)와 서비스 워커(파일을 미리 저장해 두는 백그라운드 스크립트)를 만든다.
    VitePWA({
      // 새 버전을 배포하면 다음에 앱을 열 때 자동으로 새 파일로 바뀐다
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'audio-gear',
        short_name: 'audio-gear',
        description: '헤드폰·이어폰 주파수 응답(FR) 비교',
        lang: 'ko',
        theme_color: '#2a78d6',
        background_color: '#1b1b1d',
        display: 'standalone', // 주소창 없이 앱처럼 열린다
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 앱을 이루는 파일을 모두 미리 저장해 둔다(오프라인 실행용).
        // AutoEQ 목록·측정치는 앱이 IndexedDB에 따로 저장하므로 여기서 다루지 않는다
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
