// AutoEQ 전체 기기 목록을 불러오는 훅. 처음 한 번만 받고, 이후엔 보관본을 쓴다(catalog.ts 참고)
import { useEffect, useState } from 'react'
import { loadCatalogDevices, type CatalogDevice } from './catalog'

export function useCatalogDevices() {
  const [devices, setDevices] = useState<CatalogDevice[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    // cancelled: 결과가 오기 전에 화면이 사라지면 상태를 바꾸지 않도록 하는 표시
    let cancelled = false
    loadCatalogDevices()
      .then((list) => !cancelled && setDevices(list))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
    return () => {
      cancelled = true
    }
  }, [])

  return { catalogDevices: devices, catalogError: error }
}
