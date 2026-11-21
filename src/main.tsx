import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// 글꼴: Pretendard(한글이 깔끔한 무료 글꼴, OFL). 필요한 글자 묶음만 그때그때 불러오는 "dynamic subset" 판
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './index.css'
import App from './App.tsx'
import { setupBackButton } from './backButton'
// 내 귀 균형 값을 EQ 엔진에 등록(어느 화면에서 EQ를 걸든 균형이 함께 걸리게)
import './earBalanceStore'
import './earEqStore'
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
