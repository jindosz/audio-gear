// 앱을 처음 열 때 한 번만, 이름 정리 규칙을 만들기 전에 저장된 기기들을 정리한다.
// 한 번 했다는 표시는 DB meta에 남겨서 다음부터는 하지 않는다(설정에서 언제든 다시 할 수 있음)
import { useEffect, useState } from 'react'
import { cleanupStoredDevices, getMeta, setMeta, type CleanupResult } from './repo'

const DONE_KEY = 'cleanup.devices.v1'

// 개발 모드의 React는 확인을 위해 효과를 두 번 실행하므로, 같은 작업을 두 번 하지 않게 하나로 묶는다
let startup: Promise<CleanupResult | null> | null = null

function runOnce(): Promise<CleanupResult | null> {
  startup ??= (async () => {
    if (await getMeta(DONE_KEY)) return null
    const result = await cleanupStoredDevices()
    await setMeta(DONE_KEY, new Date().toISOString())
    return result
  })()
  return startup
}

/** 바뀐 것이 있으면 결과를 돌려준다(안내 문구용). dismiss로 안내를 닫는다 */
export function useStartupCleanup() {
  const [result, setResult] = useState<CleanupResult | null>(null)
  useEffect(() => {
    runOnce()
      .then((r) => {
        if (r && r.renamed + r.deleted + r.merged > 0) setResult(r)
      })
      .catch(() => {}) // 정리에 실패해도 앱 사용에는 지장이 없다(transaction이라 바뀐 것도 없음)
  }, [])
  return { result, dismiss: () => setResult(null) }
}

/** 정리 결과를 한 문장으로 */
export function describeCleanup(r: CleanupResult): string {
  const parts = [
    r.renamed && `이름·분류 정리 ${r.renamed}개`,
    r.merged && `중복 기기 합침 ${r.merged}개`,
    r.deleted && `기기가 아닌 항목 삭제 ${r.deleted}개`,
    r.duplicateMeasurements && `중복 측정치 정리 ${r.duplicateMeasurements}개`,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : '정리할 기기가 없습니다'
}
