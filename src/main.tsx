import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, getThemePref } from './theme'

// 화면을 그리기 전에 저장된 테마를 먼저 적용한다(잠깐 다른 색이 번쩍이지 않게)
applyTheme(getThemePref())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
