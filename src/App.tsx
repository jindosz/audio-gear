// 3단 화면: 왼쪽 메뉴 | 기기 목록 | 메인(비교 탭·그래프)
import { useState } from 'react'
import { ComparePanel } from './components/ComparePanel'
import { DeviceList } from './components/DeviceList'
import { SettingsDialog } from './components/SettingsDialog'
import { Sidebar } from './components/Sidebar'
import type { DeviceCategory } from './types'
import { describeCleanup, useStartupCleanup } from './useStartupCleanup'
import { useTabs } from './useTabs'

function App() {
  const [category, setCategory] = useState<DeviceCategory>('headphone')
  // 지금 보고 있는 비교 탭. 목록에서 클릭한 기기는 이 탭에 선택된다
  const { tabs, activeId, setActiveId } = useTabs()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // 예전에 저장된 기기 이름 정리(처음 한 번만). 바뀐 것이 있으면 아래쪽에 안내를 띄운다
  const cleanup = useStartupCleanup()

  return (
    <div className="app">
      {cleanup.result && (
        <div className="toast" role="status">
          저장된 기기를 정리했습니다: {describeCleanup(cleanup.result)}
          <button type="button" onClick={cleanup.dismiss} aria-label="안내 닫기">
            ✕
          </button>
        </div>
      )}
      <Sidebar category={category} onChange={setCategory} onOpenSettings={() => setSettingsOpen(true)} />
      <DeviceList category={category} tabId={activeId} />
      <ComparePanel tabs={tabs} activeId={activeId} onSelectTab={setActiveId} category={category} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

export default App
