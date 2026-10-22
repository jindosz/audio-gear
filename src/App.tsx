// 3단 화면: 왼쪽 메뉴 | 기기 목록 | 메인(비교 탭·그래프)
import { useState } from 'react'
import { ComparePanel } from './components/ComparePanel'
import { DeviceList } from './components/DeviceList'
import { Sidebar } from './components/Sidebar'
import type { DeviceCategory } from './types'

function App() {
  const [category, setCategory] = useState<DeviceCategory>('headphone')

  return (
    <div className="app">
      <Sidebar category={category} onChange={setCategory} />
      <DeviceList category={category} />
      <ComparePanel />
    </div>
  )
}

export default App
