// IndexedDB(브라우저 안의 데이터베이스)를 Dexie로 정의하는 파일.
// 화면 코드는 이 파일의 db만 사용하고, 저장 방식은 여기서만 신경 쓴다.
import Dexie, { type EntityTable } from 'dexie'
import type { CompareTab, Device, Measurement, Target } from './types'

export const db = new Dexie('audio-gear') as Dexie & {
  devices: EntityTable<Device, 'id'>
  measurements: EntityTable<Measurement, 'id'>
  targets: EntityTable<Target, 'id'>
  tabs: EntityTable<CompareTab, 'id'>
}

// 문자열은 "기본 키, 인덱스1, 인덱스2..." 순서.
// 인덱스로 지정한 필드만 빠르게 검색할 수 있다. (owned는 boolean이라 제외)
db.version(1).stores({
  devices: 'id, category, createdAt',
  measurements: 'id, deviceId, rig',
  targets: 'id, category, rig',
  tabs: 'id, createdAt',
})
