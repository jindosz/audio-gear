// 데이터 읽기/쓰기 함수 모음.
// 화면 코드는 db를 직접 건드리지 않고 이 함수들을 부른다.
// 나중에 동기화(Supabase 등)를 붙일 때 이 파일만 고치면 되도록 하기 위함.
import { db } from './db'
import type { Device, Measurement } from './types'

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

export function listMeasurementsByDevice(deviceId: string): Promise<Measurement[]> {
  return db.measurements.where('deviceId').equals(deviceId).toArray()
}

// ---- 쓰기 ----

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
  await db.transaction('rw', db.devices, db.measurements, async () => {
    await db.measurements.where('deviceId').equals(id).delete()
    await db.devices.delete(id)
  })
}

export async function addMeasurement(input: NewMeasurement): Promise<string> {
  const id = crypto.randomUUID()
  await db.measurements.add({ ...input, id })
  return id
}

export async function deleteMeasurement(id: string): Promise<void> {
  await db.measurements.delete(id)
}
