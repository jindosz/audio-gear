// 아이콘 PNG 만들기. 그림을 바꿀 때: assets/icon-full.svg(꽉 찬 원본)와 public/icon.svg(둥근 모서리, 웹용)를 같이 고치고
//   node scripts/icons.cjs && npx pwa-assets-generator && npx @capacitor/assets generate --android
// 그다음 이 스크립트를 한 번 더 실행한다(pwa-assets-generator가 maskable·애플 아이콘을 둥근 그림으로 덮어쓰므로).
// @capacitor/assets가 android/app/src/main/AndroidManifest.xml의 줄바꿈을 바꾸면 git checkout으로 되돌린다.
// 렌더링은 미리 설치된 Playwright(Chromium)로 한다.
const { chromium } = require('playwright')
const fs = require('fs')

const full = fs.readFileSync('assets/icon-full.svg', 'utf8')
// 안드로이드 적응형 아이콘: 바탕(그라데이션만)과 앞 그림(흰 K만)을 따로
const background = full.replace(/<g[\s\S]*<\/g>/, '')
const foreground = full.replace(/<rect[^>]*\/>/, '')

const jobs = [
  ['assets/icon-only.png', full, 1024, false],
  ['assets/icon-background.png', background, 1024, false],
  ['assets/icon-foreground.png', foreground, 1024, true],
  ['public/maskable-icon-512x512.png', full, 512, false],
  ['public/apple-touch-icon-180x180.png', full, 180, false],
]

;(async () => {
  const browser = await chromium.launch()
  for (const [out, svg, size, transparent] of jobs) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`,
    )
    await page.screenshot({ path: out, omitBackground: transparent })
    await page.close()
    console.log('만듦', out)
  }
  await browser.close()
})()
