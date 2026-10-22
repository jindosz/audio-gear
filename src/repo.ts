// 데이터 읽기/쓰기 함수 모음.
// 화면 코드는 db를 직접 건드리지 않고 이 함수들을 부른다.
// 나중에 동기화(Supabase 등)를 붙일 때 이 파일만 고치면 되도록 하기 위함.
import { db } from './db'
import { addSelection, removeSelection } from './selection'
import type { CompareTab, Device, Measurement, MetaRecord } from './types'

export type NewDevice = Omit<Device, 'id' | 'createdAt'>
export type NewMeasurement = Omit<Measurement, 'id'>

// ---- 읽기 ----
// 화면에서는 useLiveQuery(() => listDevices())처럼 감싸서 쓴다.
// 그러면 DB가 바뀔 때마다 자동으로 다시 읽어 화면이 갱신된다.

export function listDevices(): Promise<Device[]> {
  return db.devices.orderBy('createdAt').toArray()
}

export function getDevice(id: string): Promise<Device | undefined> {
  return db.devices.get(id)
}

export function listMeasurements(): Promise<Measurement[]> {
  return db.measurements.toArray()
}

/** 비교 탭 목록 (만든 순서) */
export function listTabs(): Promise<CompareTab[]> {
  return db.tabs.orderBy('createdAt').toArray()
}

export function getTab(id: string): Promise<CompareTab | undefined> {
  return db.tabs.get(id)
}

export function listMeasurementsByDevice(deviceId: string): Promise<Measurement[]> {
  return db.measurements.where('deviceId').equals(deviceId).toArray()
}

/** 보관해 둔 값을 읽는다. 없으면 undefined */
export function getMeta(key: string): Promise<MetaRecord | undefined> {
  return db.meta.get(key)
}

// ---- 쓰기 ----

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value, updatedAt: Date.now() })
}


export async function addDevice(input: NewDevice): Promise<string> {
  const id = crypto.randomUUID()
  await db.devices.add({ ...input, id, createdAt: Date.now() })
  return id
}

/** 화면에 보이는 이름("브랜드 모델")이 같은 기기를 찾는다. 카탈로그에서 중복 추가를 막는 데 쓴다 */
export async function findDeviceByName(name: string): Promise<Device | undefined> {
  const devices = await db.devices.toArray()
  return devices.find((d) => `${d.brand} ${d.model}` === name)
}

export async function setDeviceOwned(id: string, owned: boolean): Promise<void> {
  await db.devices.update(id, { owned })
}

/** 기기와 그 기기의 측정치를 함께 삭제한다 */
export async function deleteDevice(id: string): Promise<void> {
  // transaction: 안의 작업이 전부 성공하거나 전부 취소된다(중간에 실패해도 반쯤 지워진 상태가 남지 않음)
  await db.transaction('rw', db.devices, db.measurements, db.tabs, async () => {
    const measurementIds = (await db.measurements.where('deviceId').equals(id).primaryKeys()) as string[]
    await db.measurements.bulkDelete(measurementIds)
    await db.devices.delete(id)
    await unselectEverywhere(measurementIds)
  })
}

export async function addMeasurement(input: NewMeasurement): Promise<string> {
  const id = crypto.randomUUID()
  await db.measurements.add({ ...input, id })
  return id
}

export async function deleteMeasurement(id: string): Promise<void> {
  await db.transaction('rw', db.measurements, db.tabs, async () => {
    await db.measurements.delete(id)
    await unselectEverywhere([id])
  })
}

// ---- 비교 탭 ----

/** 새 비교 탭을 만들고 id를 돌려준다. 이름은 "비교 N" (지금 있는 번호 중 가장 큰 것 + 1) */
export async function createTab(): Promise<string> {
  return db.transaction('rw', db.tabs, async () => {
    const numbers = (await db.tabs.toArray()).map((t) => Number(t.name.match(/^비교 (\d+)$/)?.[1] ?? 0))
    const id = crypto.randomUUID()
    await db.tabs.add({
      id,
      name: `비교 ${Math.max(0, ...numbers) + 1}`,
      selections: [],
      normalizeHz: 1000,
      targetId: null,
      createdAt: Date.now(),
    })
    return id
  })
}

/** 탭이 하나도 없으면 하나 만든다. 앱 시작 시 부른다 */
export async function ensureTab(): Promise<void> {
  // transaction 안에서 개수를 세고 만들기 때문에, 두 번 연달아 불려도 탭이 두 개 생기지 않는다
  await db.transaction('rw', db.tabs, async () => {
    if ((await db.tabs.count()) === 0) await createTab()
  })
}

/** 탭을 닫는다(삭제). 마지막 탭이었으면 빈 탭을 새로 만들어 항상 하나는 남긴다 */
export async function deleteTab(id: string): Promise<void> {
  await db.transaction('rw', db.tabs, async () => {
    await db.tabs.delete(id)
    if ((await db.tabs.count()) === 0) await createTab()
  })
}

// ---- 비교 선택 ----

export type ToggleResult = 'selected' | 'unselected' | 'full'

/** 측정치를 비교 탭에서 선택하거나 해제한다. 색이 모두 쓰이고 있으면 'full'을 돌려준다 */
export async function toggleSelection(tabId: string, measurementId: string): Promise<ToggleResult> {
  return db.transaction('rw', db.tabs, async () => {
    const tab = await db.tabs.get(tabId)
    if (!tab) throw new Error('비교 탭을 찾을 수 없습니다.')
    const isSelected = tab.selections.some((s) => s.measurementId === measurementId)
    const next = isSelected
      ? removeSelection(tab.selections, [measurementId])
      : addSelection(tab.selections, measurementId)
    if (next === null) return 'full'
    await db.tabs.put({ ...tab, selections: next })
    return isSelected ? 'unselected' : 'selected'
  })
}

/** 비교 탭의 정규화 기준 주파수를 바꾼다. null이면 정규화하지 않음 */
export async function setNormalizeHz(tabId: string, normalizeHz: number | null): Promise<void> {
  await db.tabs.update(tabId, { normalizeHz })
}

/** 삭제된 측정치를 모든 탭의 선택에서 뺀다(지워진 측정치를 가리키는 선택이 남지 않게) */
async function unselectEverywhere(measurementIds: string[]): Promise<void> {
  await db.tabs.toCollection().modify((tab) => {
    tab.selections = removeSelection(tab.selections, measurementIds)
  })
}
