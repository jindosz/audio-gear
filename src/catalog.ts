// AutoEQ 공개 목록을 "전체 기기 카탈로그"로 쓰는 코드.
// https://github.com/jaakkopasanen/AutoEq (코드는 MIT 라이선스, 측정치 저작권은 각 측정자에게 있음)
// 측정치는 앱에 넣어 배포하지 않고, 사용자가 고를 때만 GitHub에서 받아 출처를 붙여 저장한다.
import { parseFrCsv } from './csv'
import { addDevice, addMeasurement, findDeviceByName, getMeta, listMeasurementsByDevice, setMeta } from './repo'
import type { DeviceCategory, FrCurve, Rig } from './types'

const RAW_BASE = 'https://raw.githubusercontent.com/jaakkopasanen/AutoEq/master/results'

/** 카탈로그 항목 하나 = 기기 하나의 측정 결과 하나(같은 기기라도 출처가 다르면 따로 있음) */
export interface CatalogEntry {
  name: string
  /** 측정자. 예: oratory1990, crinacle */
  source: string
  /** 측정 리그 원래 이름. 예: "GRAS 43AG-7", 없으면 빈 문자열 */
  rigName: string
  rig: Rig
  category: DeviceCategory
  /** results 폴더 기준 경로. 예: "oratory1990/over-ear/Sennheiser HD 600" */
  path: string
  /** crinacle은 측정치 CSV가 공개되어 있지 않다 */
  hasCurve: boolean
  /** AutoEQ가 이 기기의 측정치 중 가장 정확하다고 고른 것 */
  recommended: boolean
}

/**
 * AutoEQ results/INDEX.md를 읽어 카탈로그로 바꾼다. 줄 형식 예:
 * - [Sennheiser HD 600](./oratory1990/over-ear/Sennheiser%20HD%20600) by oratory1990
 * - [1MORE MK801](./crinacle/GRAS%2043AG-7%20over-ear/1MORE%20MK801) by crinacle on GRAS 43AG-7
 *
 * recommendedText(results/README.md)에는 기기마다 추천 측정치 하나의 경로가 같은 형식으로 들어 있다.
 */
export function parseAutoEqIndex(text: string, recommendedText = ''): CatalogEntry[] {
  const recommendedPaths = new Set<string>()
  for (const line of recommendedText.split(/\r?\n/)) {
    const match = line.match(/^- \[.+\]\(\.\/(.+)\)$/)
    if (match) recommendedPaths.add(decodeURIComponent(match[1]))
  }

  const entries: CatalogEntry[] = []
  for (const line of text.split(/\r?\n/)) {
    // 정규식의 ( ) 부분이 이름, 경로, 출처, 리그를 하나씩 잡아낸다
    const match = line.match(/^- \[(.+)\]\(\.\/(.+)\) by (.+?)(?: on (.+))?$/)
    if (!match) continue
    const [, name, encodedPath, source, rigName = ''] = match
    const path = decodeURIComponent(encodedPath)
    const formDir = path.split('/')[1] ?? '' // 예: "GRAS 43AG-7 over-ear", "in-ear"
    entries.push({
      name,
      source,
      rigName,
      rig: toRig(rigName),
      category: formDir.endsWith('over-ear') ? 'headphone' : 'iem',
      path,
      hasCurve: source !== 'crinacle',
      recommended: recommendedPaths.has(path),
    })
  }
  return entries
}

function toRig(rigName: string): Rig {
  if (rigName.includes('5128')) return '5128'
  if (rigName.includes('711')) return '711'
  if (rigName.includes('GRAS')) return 'gras'
  return 'other'
}

// ---- 목록 받기와 보관 ----
// 목록 원문(INDEX.md 약 850KB + README.md 약 490KB)은 DB의 meta 테이블에 보관한다.
// 그래서 두 번째 실행부터는 인터넷 없이도 바로 목록이 뜬다. 7일이 지나면 뒤에서 조용히 새로 받는다.

const INDEX_KEY = 'autoeq.index'
const RECOMMENDED_KEY = 'autoeq.recommended'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

async function fetchText(file: string): Promise<string> {
  const res = await fetch(`${RAW_BASE}/${file}`)
  if (!res.ok) throw new Error(`목록을 받지 못했습니다 (${res.status})`)
  return res.text()
}

async function downloadAndStore(): Promise<[string, string]> {
  const [index, recommended] = await Promise.all([fetchText('INDEX.md'), fetchText('README.md')])
  await setMeta(INDEX_KEY, index)
  await setMeta(RECOMMENDED_KEY, recommended)
  return [index, recommended]
}

async function loadTexts(): Promise<[string, string]> {
  const [index, recommended] = await Promise.all([getMeta(INDEX_KEY), getMeta(RECOMMENDED_KEY)])
  if (!index || !recommended) return downloadAndStore()
  if (Date.now() - index.updatedAt > MAX_AGE_MS) {
    // 오래된 목록이면 지금은 보관본을 쓰고, 새 목록은 다음 실행부터 반영된다. 실패해도 무시
    downloadAndStore().catch(() => {})
  }
  return [index.value, recommended.value]
}

// 한 번 읽은 목록은 앱을 끌 때까지 기억해 둔다
let catalogPromise: Promise<CatalogEntry[]> | null = null

export function loadCatalog(): Promise<CatalogEntry[]> {
  catalogPromise ??= loadTexts()
    .then(([index, recommended]) => parseAutoEqIndex(index, recommended))
    .catch((err) => {
      catalogPromise = null // 실패하면 다음에 다시 시도할 수 있게 비워 둔다
      throw err
    })
  return catalogPromise
}

/** 전체 기기 목록용: 기기 이름별로 묶은 카탈로그 */
export interface CatalogDevice {
  name: string
  category: DeviceCategory
  /** 검색용으로 미리 normalize한 이름 */
  searchKey: string
  /** 클릭했을 때 받을 측정치: 추천 측정치, 추천이 비공개면 공개된 것 중 첫 번째. 없으면 undefined */
  primary: CatalogEntry | undefined
}

export function groupCatalog(entries: CatalogEntry[]): CatalogDevice[] {
  const byName = new Map<string, CatalogEntry[]>()
  for (const e of entries) byName.set(e.name, [...(byName.get(e.name) ?? []), e])

  return [...byName.entries()].map(([name, list]) => {
    const primary = list.find((e) => e.recommended && e.hasCurve) ?? list.find((e) => e.hasCurve)
    const category = (list.find((e) => e.recommended) ?? list[0]).category
    return { name, category, searchKey: normalize(name), primary }
  })
}

let devicesPromise: Promise<CatalogDevice[]> | null = null

export function loadCatalogDevices(): Promise<CatalogDevice[]> {
  devicesPromise ??= loadCatalog()
    .then(groupCatalog)
    .catch((err) => {
      devicesPromise = null
      throw err
    })
  return devicesPromise
}

/** 검색어 비교용: 소문자로 바꾸고 공백·기호를 지운다 ("HD600"과 "HD 600"이 같게 됨) */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

/** 검색 결과 한 줄: 같은 이름의 항목(출처별 측정)을 묶은 것 */
export interface CatalogGroup {
  name: string
  category: DeviceCategory
  entries: CatalogEntry[]
}

/** 띄어쓰기로 나눈 검색어가 모두 이름에 들어 있는 기기를 이름별로 묶어 찾는다 */
export function searchCatalog(entries: CatalogEntry[], query: string, limit = 30): CatalogGroup[] {
  const words = query.split(/\s+/).map(normalize).filter(Boolean)
  if (words.length === 0) return []
  // Map: 키(이름)로 값(묶음)을 찾는 자료구조. 넣은 순서가 유지된다
  const groups = new Map<string, CatalogGroup>()
  for (const entry of entries) {
    const target = normalize(entry.name)
    if (!words.every((w) => target.includes(w))) continue
    const group = groups.get(entry.name)
    if (group) {
      group.entries.push(entry)
    } else {
      if (groups.size >= limit) continue
      groups.set(entry.name, { name: entry.name, category: entry.category, entries: [entry] })
    }
  }
  return [...groups.values()]
}

/** 고른 항목의 측정치 CSV를 받아 곡선으로 바꾼다 */
export async function fetchCatalogCurve(entry: CatalogEntry): Promise<FrCurve> {
  const fileName = entry.path.split('/').pop()
  const url = `${RAW_BASE}/${encodeURI(entry.path)}/${encodeURIComponent(`${fileName}.csv`)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`측정치를 받지 못했습니다 (${res.status})`)
  return parseFrCsv(await res.text()).curve
}

// 여러 단어로 된 브랜드. 나머지는 첫 단어를 브랜드로 본다.
// 화면에는 "브랜드 + 모델"을 이어 붙여 보여주므로 나눔이 틀려도 표시는 원래 이름과 같다.
const MULTI_WORD_BRANDS = [
  '64 Audio', 'Bang & Olufsen', 'Bowers & Wilkins', 'Campfire Audio', 'Dan Clark Audio',
  'Empire Ears', 'Final Audio', 'Master & Dynamic', 'Meze Audio', 'Noble Audio',
  'Tin HiFi', 'Ultimate Ears', 'Unique Melody',
]

export function splitBrand(name: string): { brand: string; model: string } {
  const brand = MULTI_WORD_BRANDS.find((b) => name.startsWith(`${b} `)) ?? name.split(' ')[0]
  return { brand, model: name.slice(brand.length).trim() }
}

export type AddResult = 'added' | 'deviceOnly' | 'measurementAdded' | 'alreadyExists'

/** 추가 결과. measurementId는 새로 추가했거나 이미 있던 같은 출처 측정치의 id */
export interface AddOutcome {
  result: AddResult
  deviceId: string
  measurementId?: string
}

/**
 * 카탈로그 항목을 내 기기로 추가한다.
 * - 같은 이름의 기기가 이미 있으면 기기는 새로 만들지 않고 측정치만 붙인다
 * - 같은 출처의 측정치가 이미 있으면 새로 받지 않고 그 측정치를 돌려준다
 */
export async function addFromCatalog(entry: CatalogEntry, owned: boolean): Promise<AddOutcome> {
  const source = `AutoEQ · ${entry.source}`
  const existing = await findDeviceByName(entry.name)
  if (existing) {
    const same = (await listMeasurementsByDevice(existing.id)).find((m) => m.source === source)
    if (same || !entry.hasCurve) return { result: 'alreadyExists', deviceId: existing.id, measurementId: same?.id }
  }

  // 네트워크에서 먼저 받아 둔다. 실패하면 여기서 오류가 나서 DB에는 아무것도 저장되지 않는다
  const curve = entry.hasCurve ? await fetchCatalogCurve(entry) : null

  const deviceId =
    existing?.id ?? (await addDevice({ ...splitBrand(entry.name), category: entry.category, owned, notes: '' }))
  if (!curve) return { result: 'deviceOnly', deviceId }

  const measurementId = await addMeasurement({ deviceId, variant: '', rig: entry.rig, source, channel: 'avg', curve })
  return { result: existing ? 'measurementAdded' : 'added', deviceId, measurementId }
}
