// 비교 탭 목록과 "지금 보고 있는 탭"을 관리하는 훅.
// 탭 내용(선택, 정규화 등)은 DB에, 지금 보고 있는 탭 id는 이 브라우저의 localStorage에 둔다.
// (어느 탭을 보고 있었는지는 기기마다 달라도 되는 화면 상태라서)
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ensureTab, listTabs } from './repo'

const STORAGE_KEY = 'audio-gear.activeTabId'

// localStorage는 사생활 보호 모드 등에서 막혀 있을 수 있어서 try/catch로 감싼다
function loadActiveId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function saveActiveId(id: string) {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // 저장 못 해도 다음에 첫 번째 탭이 열릴 뿐이라 무시한다
  }
}

export function useTabs() {
  const tabs = useLiveQuery(listTabs)
  const [wantedId, setWantedId] = useState<string | null>(loadActiveId)

  // 탭이 하나도 없으면(처음 실행) 하나 만든다
  useEffect(() => {
    if (tabs?.length === 0) void ensureTab()
  }, [tabs])

  // 원하는 탭이 없으면(닫혔거나 처음이면) 첫 번째 탭을 보여준다
  const activeId = tabs?.find((t) => t.id === wantedId)?.id ?? tabs?.[0]?.id

  useEffect(() => {
    if (activeId) saveActiveId(activeId)
  }, [activeId])

  return { tabs: tabs ?? [], activeId, setActiveId: setWantedId }
}
