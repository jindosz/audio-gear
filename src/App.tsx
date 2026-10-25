// 3단 화면: 왼쪽 메뉴 | 기기 목록 | 메인(비교 탭·그래프)
import { useEffect, useState, type CSSProperties } from 'react'
import { ComparePanel } from './components/ComparePanel'
import { DeviceList } from './components/DeviceList'
import { EqPage } from './components/EqPage'
import { ResizeHandle } from './components/ResizeHandle'
import { SettingsDialog } from './components/SettingsDialog'
import { Sidebar, type Page } from './components/Sidebar'
import { EQ_ACTIVE_KEY, readPref, writePref } from './localPrefs'
import type { DeviceCategory } from './types'
import { describeCleanup, useStartupCleanup } from './useStartupCleanup'
import { useTabs } from './useTabs'

/** 기기 목록 칸 폭(px) 범위와 기본값 */
const LIST_WIDTH = { min: 200, max: 640, default: 260 }

function App() {
  const [category, setCategory] = useState<DeviceCategory>('headphone')
  // 지금 보고 있는 비교 탭. 목록에서 클릭한 기기는 이 탭에 선택된다
  const { tabs, activeId, setActiveId } = useTabs()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [page, setPage] = useState<Page>('devices')
  // 예전에 저장된 기기 이름 정리(처음 한 번만). 바뀐 것이 있으면 아래쪽에 안내를 띄운다
  const cleanup = useStartupCleanup()
  // 기기 목록 칸 폭(px). 끌어서 바꾼 폭은 이 브라우저에 기억한다
  const [listWidth, setListWidth] = useState(() => readPref('listWidth', LIST_WIDTH.default))
  useEffect(() => writePref('listWidth', listWidth), [listWidth])

  return (
    <div className="app" style={{ '--list-width': `${listWidth}px` } as CSSProperties}>
      {cleanup.result && (
        <div className="toast" role="status">
          저장된 기기를 정리했습니다: {describeCleanup(cleanup.result)}
          <button type="button" onClick={cleanup.dismiss} aria-label="안내 닫기">
            ✕
          </button>
        </div>
      )}
      <Sidebar
        category={category}
        page={page}
        onChange={(c) => {
          setCategory(c)
          setPage('devices')
        }}
        onOpenEq={() => setPage('eq')}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {page === 'eq' ? (
        <EqPage />
      ) : (
        <>
          <DeviceList category={category} tabId={activeId} />
          <ResizeHandle
            width={listWidth}
            min={LIST_WIDTH.min}
            max={LIST_WIDTH.max}
            defaultWidth={LIST_WIDTH.default}
            onChange={setListWidth}
          />
          <ComparePanel
            tabs={tabs}
            activeId={activeId}
            onSelectTab={setActiveId}
            category={category}
            onOpenEqPreset={(id) => {
              // EQ 화면은 열릴 때 기억된 EQ id를 읽으므로, 먼저 적어 두고 화면을 바꾼다
              writePref(EQ_ACTIVE_KEY, id)
              setPage('eq')
            }}
          />
        </>
      )}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

export default App
