// IndexedDB(브라우저 안의 데이터베이스)를 Dexie로 정의하는 파일.
// 화면 코드는 이 파일의 db만 사용하고, 저장 방식은 여기서만 신경 쓴다.
import Dexie, { type EntityTable } from 'dexie'
import type { CatalogSummary, CompareTab, Device, Measurement, MetaRecord, Target } from './types'

export const db = new Dexie('audio-gear') as Dexie & {
  devices: EntityTable<Device, 'id'>
  measurements: EntityTable<Measurement, 'id'>
  targets: EntityTable<Target, 'id'>
  tabs: EntityTable<CompareTab, 'id'>
  meta: EntityTable<MetaRecord, 'key'>
  summaries: EntityTable<CatalogSummary, 'path'>
}

// 문자열은 "기본 키, 인덱스1, 인덱스2..." 순서.
// 인덱스로 지정한 필드만 빠르게 검색할 수 있다. (owned는 boolean이라 제외)
db.version(1).stores({
  devices: 'id, category, createdAt',
  measurements: 'id, deviceId, rig',
  targets: 'id, category, rig',
  tabs: 'id, createdAt',
})

// 버전 2: 내려받은 AutoEQ 목록 같은 "앱이 보관하는 값"을 저장할 meta 테이블 추가.
// 테이블 구조를 바꿀 때는 기존 version(1)을 고치지 않고 새 번호를 올린다.
// 그러면 이미 버전 1 DB를 쓰던 브라우저도 데이터를 유지한 채 자동으로 버전 2로 바뀐다(마이그레이션).
db.version(2).stores({
  meta: 'key',
})

// 버전 3: 추천용 요약값 테이블. 카테고리별로 세고 읽을 수 있게 category 인덱스
db.version(3).stores({
  summaries: 'path, category',
})
