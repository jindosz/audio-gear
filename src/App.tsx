// 임시 단일 화면: 기기 목록 + 기기 추가 팝업 + 측정치 업로드.
// 2단계에서 3단 레이아웃으로 바꿀 예정.
import { useState } from 'react'
import { AddDeviceDialog } from './components/AddDeviceDialog'
import { DeviceList } from './components/DeviceList'

function App() {
  const [addOpen, setAddOpen] = useState(false)

  return (
    <main>
      <header className="app-head">
        <h1>audio-gear</h1>
        <button className="primary" onClick={() => setAddOpen(true)}>
          + 기기 추가
        </button>
      </header>
      <DeviceList />
      <AddDeviceDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </main>
  )
}

export default App
