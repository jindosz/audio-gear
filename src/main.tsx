import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { setupBackButton } from './backButton'
import { applyTheme, getThemePref } from './theme'

// 화면을 그리기 전에 저장된 테마를 먼저 적용한다(잠깐 다른 색이 번쩍이지 않게)
applyTheme(getThemePref())

// 안드로이드 앱: 뒤로 가기는 팝업 닫기 → 없으면 앱을 뒤로 보내기
setupBackButton()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
