// 백업 파일(JSON) 형식과 검사. 화면·DB와 상관없는 순수 함수라 따로 테스트할 수 있다.
//
// 백업에 넣는 것: 기기, 측정치, 타깃, 비교 탭.
// 넣지 않는 것: AutoEQ 목록 보관본(meta) — 언제든 다시 받을 수 있고 크기만 크다.
import type { CompareTab, Device, Measurement, Target } from './types'

export const BACKUP_APP = 'audio-gear'
/** 백업 형식 버전. 나중에 형식을 바꾸면 올리고, 가져올 때 옛 버전을 변환한다 */
export const BACKUP_VERSION = 1

export interface BackupData {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  devices: Device[]
  measurements: Measurement[]
  targets: Target[]
  tabs: CompareTab[]
}

export interface BackupSummary {
  devices: number
  measurements: number
  targets: number
  tabs: number
}

export function summarize(data: BackupData): BackupSummary {
  return {
    devices: data.devices.length,
    measurements: data.measurements.length,
    targets: data.targets.length,
    tabs: data.tabs.length,
  }
}

// ---- 검사 ----
// 백업 파일은 사용자가 고른 아무 파일일 수 있어서, DB에 넣기 전에 모양을 확인한다.
// unknown: "아직 무슨 값인지 모름". 하나씩 확인해서 안전한 타입으로 좁혀 간다.

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isString = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function isCurve(v: unknown): boolean {
  return Array.isArray(v) && v.every((p) => isObject(p) && isNumber(p.freq) && isNumber(p.db))
}

function isDevice(v: unknown): v is Device {
  return (
    isObject(v) &&
    isString(v.id) &&
    isString(v.brand) &&
    isString(v.model) &&
    (v.category === 'headphone' || v.category === 'iem') &&
    typeof v.owned === 'boolean' &&
    isNumber(v.createdAt)
  )
}

function isMeasurement(v: unknown): v is Measurement {
  return isObject(v) && isString(v.id) && isString(v.deviceId) && isString(v.rig) && isCurve(v.curve)
}

function isTarget(v: unknown): v is Target {
  return isObject(v) && isString(v.id) && isString(v.name) && isString(v.rig) && isCurve(v.curve)
}

function isTab(v: unknown): v is CompareTab {
  return isObject(v) && isString(v.id) && isString(v.name) && Array.isArray(v.selections) && isNumber(v.createdAt)
}

/** 모든 항목이 검사를 통과하는지. 하나라도 틀리면 몇 번째가 틀렸는지 알려준다 */
function checkAll<T>(list: unknown, check: (v: unknown) => v is T, label: string): T[] {
  if (!Array.isArray(list)) throw new Error(`${label} 목록이 없습니다.`)
  const bad = list.findIndex((v) => !check(v))
  if (bad >= 0) throw new Error(`${label} ${bad + 1}번째 항목의 형식이 올바르지 않습니다.`)
  return list as T[]
}

/**
 * 백업 파일 내용을 읽어 검사한다. 문제가 있으면 이유가 담긴 오류를 던진다.
 * 탭의 선택 중 백업에 없는 측정치를 가리키는 것은 조용히 뺀다.
 */
export function parseBackup(text: string): BackupData {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('JSON 파일이 아닙니다.')
  }
  if (!isObject(raw) || raw.app !== BACKUP_APP) throw new Error('audio-gear 백업 파일이 아닙니다.')
  if (!isNumber(raw.version) || raw.version > BACKUP_VERSION) {
    throw new Error('이 앱보다 새로운 버전에서 만든 백업입니다. 앱을 업데이트한 뒤 가져오세요.')
  }

  const devices = checkAll(raw.devices, isDevice, '기기')
  const measurements = checkAll(raw.measurements, isMeasurement, '측정치')
  const targets = checkAll(raw.targets, isTarget, '타깃')
  const measurementIds = new Set(measurements.map((m) => m.id))
  const tabs = checkAll(raw.tabs, isTab, '비교 탭').map((tab) => ({
    ...tab,
    selections: tab.selections.filter((s) => measurementIds.has(s.measurementId)),
  }))

  return {
    app: BACKUP_APP,
    version: raw.version,
    exportedAt: isString(raw.exportedAt) ? raw.exportedAt : '',
    devices,
    measurements,
    targets,
    tabs,
  }
}

/** 백업 파일 이름. 예: audio-gear-backup-2026-10-22.json */
export function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `audio-gear-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}
