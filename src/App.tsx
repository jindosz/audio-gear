// 3단 화면: 왼쪽 메뉴 | 기기 목록 | 메인(비교 탭·그래프)
import { useState } from 'react'
import { DeviceList } from './components/DeviceList'
import { Sidebar } from './components/Sidebar'
import type { DeviceCategory } from './types'

function App() {
  const [category, setCategory] = useState<DeviceCategory>('headphone')

  return (
    <div className="app">
      <Sidebar category={category} onChange={setCategory} />
      <DeviceList category={category} />
      <main className="main-col">
        {/* 다음 단계에서 비교 탭과 FR 그래프가 들어갈 자리 */}
        <p className="muted placeholder">기기를 선택하면 여기에 그래프가 표시됩니다.</p>
      </main>
    </div>
  )
}

export default App
