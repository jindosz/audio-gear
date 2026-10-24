// 전체 기기 목록(AutoEQ + squig.link)을 불러오는 훅.
// AutoEQ 목록은 빨리 뜨므로 먼저 보여주고, squig.link 목록은 준비되는 대로 합친다.
// 둘 다 처음 한 번만 받고 이후엔 DB의 보관본을 쓴다(catalog.ts, squig.ts 참고)
import { useEffect, useMemo, useState } from 'react'
import { groupCatalog, loadCatalog, type CatalogEntry } from './catalog'
import { loadSquigCatalog, onSquigProgress, type SquigProgress } from './squig'

export function useCatalogDevices() {
  const [autoeq, setAutoeq] = useState<CatalogEntry[] | null>(null)
  const [squig, setSquig] = useState<CatalogEntry[] | null>(null)
  const [error, setError] = useState('')
  const [squigError, setSquigError] = useState('')
  // squig.link 목록을 처음 받을 때의 진행 상황(사이트 몇 곳 중 몇 곳)
  const [squigProgress, setSquigProgress] = useState<SquigProgress | null>(null)

  useEffect(() => {
    // cancelled: 결과가 오기 전에 화면이 사라지면 상태를 바꾸지 않도록 하는 표시
    let cancelled = false
    loadCatalog()
      .then((list) => !cancelled && setAutoeq(list))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
    const unsubscribe = onSquigProgress(setSquigProgress)
    loadSquigCatalog()
      .then((list) => !cancelled && setSquig(list))
      .catch((err: unknown) => !cancelled && setSquigError(err instanceof Error ? err.message : String(err)))
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  // 묶기·정렬은 수만 개라 무거우니 목록이 바뀔 때만 다시 한다
  const catalogDevices = useMemo(() => (autoeq ? groupCatalog([...autoeq, ...(squig ?? [])]) : null), [autoeq, squig])

  return {
    catalogDevices,
    catalogError: error,
    /** squig.link 목록이 합쳐졌는지 */
    squigReady: squig !== null,
    squigError,
    squigProgress,
  }
}
