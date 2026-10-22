// 목록과 메인 화면이 함께 쓰는 "기기 + 측정치 + 현재 비교 탭" 데이터 묶음.
// use로 시작하는 함수는 "커스텀 훅": 다른 훅(useLiveQuery 등)을 묶어 재사용하는 함수다.
import { useLiveQuery } from 'dexie-react-hooks'
import { getActiveTab, listDevices, listMeasurements } from './repo'
import type { CompareSelection, Device, Measurement } from './types'

export interface SelectedItem {
  selection: CompareSelection
  measurement: Measurement
  device: Device
}

export function useCompareData() {
  const devices = useLiveQuery(listDevices)
  const measurements = useLiveQuery(listMeasurements)
  // 탭이 아직 없으면 undefined. null과 구분하려고 객체로 감싼다
  const tab = useLiveQuery(async () => ({ value: await getActiveTab() }))

  const loading = devices === undefined || measurements === undefined || tab === undefined

  // 기기 id → 그 기기의 측정치 목록
  const measurementsByDevice = new Map<string, Measurement[]>()
  for (const m of measurements ?? []) {
    const list = measurementsByDevice.get(m.deviceId) ?? []
    list.push(m)
    measurementsByDevice.set(m.deviceId, list)
  }

  // 선택된 순서대로 측정치·기기 정보를 붙인다
  const deviceById = new Map((devices ?? []).map((d) => [d.id, d]))
  const measurementById = new Map((measurements ?? []).map((m) => [m.id, m]))
  const selected: SelectedItem[] = []
  for (const selection of tab?.value?.selections ?? []) {
    const measurement = measurementById.get(selection.measurementId)
    const device = measurement && deviceById.get(measurement.deviceId)
    if (measurement && device) selected.push({ selection, measurement, device })
  }

  return { loading, devices: devices ?? [], measurementsByDevice, selected, tab: tab?.value }
}
