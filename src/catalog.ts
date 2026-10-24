// "전체 기기 카탈로그": AutoEQ 공개 목록 + squig.link 목록(squig.ts).
// https://github.com/jaakkopasanen/AutoEq (코드는 MIT 라이선스, 측정치 저작권은 각 측정자에게 있음)
// 측정치는 앱에 넣어 배포하지 않고, 사용자가 고를 때만 받아 출처를 붙여 저장한다.
import { dbAt } from './curve'
import { parseFrCsv } from './csv'
import { addDevice, addMeasurement, findDeviceByName, getMeta, listMeasurementsByDevice, setMeta } from './repo'
import { cleanName, splitBrand } from './nameClean'
import { loadSquigCatalog } from './squig'
import { normalize } from './text'
import type { DeviceCategory, FrCurve, Rig } from './types'

export { normalize }

const RAW_BASE = 'https://raw.githubusercontent.com/jaakkopasanen/AutoEq/master/results'

/** 카탈로그 항목 하나 = 기기 하나의 측정 결과 하나(같은 기기라도 출처가 다르면 따로 있음) */
export interface CatalogEntry {
  /** 어디 목록에서 왔는지 */
  provider: 'autoeq' | 'squig'
  name: string
  /** 브랜드를 따로 알 때(squig.link). 없으면 이름에서 추정한다(splitBrand) */
  brand?: string
  /** 같은 기기의 측정 구성(팁·패드·ANC 등). 측정치의 variant로 저장된다 */
  variant?: string
  /** 측정자. 예: oratory1990, crinacle */
  source: string
  /** 측정 리그 원래 이름. 예: "GRAS 43AG-7", 없으면 빈 문자열 */
  rigName: string
  rig: Rig
  category: DeviceCategory
  /** 측정치 하나를 가리키는 고유 이름. AutoEQ는 results 폴더 기준 경로(예: "oratory1990/over-ear/Sennheiser HD 600") */
  path: string
  /** squig.link: 받을 파일 주소(왼쪽·오른쪽). 받은 뒤 평균 낸다 */
  files?: string[]
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
      provider: 'autoeq',
      // AutoEQ 이름도 겹친 공백·괄호 짝 같은 표기만 squig.link와 같은 규칙으로 맞춘다
      name: cleanName(name) ?? name,
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

/**
 * 같은 기기의 항목들을 하나로 묶는다. 출처마다 이름 표기가 조금씩 달라서("HD600" / "HD 600")
 * 공백·기호를 지운 이름(normalize)이 같으면 같은 기기로 본다.
 * - 보여줄 이름과 카테고리는 AutoEQ 쪽을 우선(AutoEQ는 이름이 정리돼 있음)
 * - 클릭했을 때 받을 측정치: AutoEQ 추천 → AutoEQ 공개 측정치 → squig.link 첫 번째
 * - 결과는 이름순(목록을 매번 다시 정렬하지 않게 미리 정렬해 둔다)
 */
/** 항목들 중 더 많은 쪽 카테고리. 같으면 이어폰(squig.link는 이어폰 측정이 훨씬 많다) */
function majorityCategory(list: CatalogEntry[]): DeviceCategory {
  const headphones = list.filter((e) => e.category === 'headphone').length
  return headphones > list.length - headphones ? 'headphone' : 'iem'
}

export function groupCatalog(entries: CatalogEntry[]): CatalogDevice[] {
  const byKey = new Map<string, CatalogEntry[]>()
  for (const e of entries) {
    const key = normalize(e.name)
    const list = byKey.get(key)
    if (list) list.push(e)
    else byKey.set(key, [e])
  }

  // 브랜드 표기 맞추기: 사이트마다 "Hifiman" / "HIFIMAN"처럼 대소문자를 다르게 적어서,
  // 이름의 첫 단어(대부분 브랜드)를 가장 많이 쓰인 표기로 바꿔 보여준다.
  // AutoEQ 표기를 우선하도록 AutoEQ는 10표, squig.link 사이트는 1표씩 센다
  const firstWord = (name: string) => name.split(' ')[0]
  const wordCounts = new Map<string, Map<string, number>>()
  for (const e of entries) {
    const word = firstWord(e.name)
    const key = word.toLowerCase()
    const counts = wordCounts.get(key) ?? new Map<string, number>()
    counts.set(word, (counts.get(word) ?? 0) + (e.provider === 'autoeq' ? 10 : 1))
    wordCounts.set(key, counts)
  }
  const canonicalWord = new Map(
    [...wordCounts.entries()].map(([key, counts]) => [key, [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]]),
  )
  const displayName = (e: CatalogEntry) => {
    const word = firstWord(e.name)
    return (canonicalWord.get(word.toLowerCase()) ?? word) + e.name.slice(word.length)
  }

  const collator = new Intl.Collator('en')
  return [...byKey.entries()]
    .map(([searchKey, list]) => {
      const autoeq = list.filter((e) => e.provider === 'autoeq')
      const main = autoeq.find((e) => e.recommended) ?? autoeq[0] ?? list[0]
      const primary =
        autoeq.find((e) => e.recommended && e.hasCurve) ?? autoeq.find((e) => e.hasCurve) ?? list.find((e) => e.hasCurve)
      // 카테고리: AutoEQ에 있으면 AutoEQ 분류, 없으면 여러 사이트의 다수결
      // (헤드폰 목록에 이어폰을 섞어 둔 사이트가 있어도, 다른 사이트들이 이어폰으로 분류했으면 이어폰으로 본다)
      const category = autoeq.length ? main.category : majorityCategory(list)
      return { name: displayName(main), category, searchKey, primary }
    })
    .sort((a, b) => collator.compare(a.name, b.name))
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
    // 표기가 조금 달라도(공백·기호) 같은 기기로 묶는다
    const group = groups.get(target)
    if (group) {
      group.entries.push(entry)
    } else {
      if (groups.size >= limit) continue
      groups.set(target, { name: entry.name, category: entry.category, entries: [entry] })
    }
  }
  return [...groups.values()]
}

/** 여러 채널(왼쪽·오른쪽) 곡선의 평균. 첫 곡선의 주파수 위치에서 나머지 값을 보간해 더한다 */
function averageChannels(curves: FrCurve[]): FrCurve {
  const [first, ...rest] = curves
  if (rest.length === 0) return first
  return first.flatMap(({ freq, db }) => {
    const others = rest.map((c) => dbAt(c, freq))
    if (others.some((v) => v === null)) return []
    const sum = others.reduce<number>((a, b) => a + (b ?? 0), db)
    return [{ freq, db: sum / curves.length }]
  })
}

/** 고른 항목의 측정치를 받아 곡선으로 바꾼다 */
export async function fetchCatalogCurve(entry: CatalogEntry): Promise<FrCurve> {
  if (entry.provider === 'squig') {
    // 왼쪽·오른쪽 파일을 받아 받아진 것만 평균 낸다(한쪽만 올린 사이트도 있다)
    const results = await Promise.all(
      (entry.files ?? []).map((url) =>
        fetch(url)
          .then(async (r) => (r.ok ? parseFrCsv(await r.text()).curve : null))
          .catch(() => null),
      ),
    )
    const curves = results.filter((c): c is FrCurve => c !== null)
    if (curves.length === 0) throw new Error('측정치를 받지 못했습니다')
    return averageChannels(curves)
  }
  const fileName = entry.path.split('/').pop()
  const url = `${RAW_BASE}/${encodeURI(entry.path)}/${encodeURIComponent(`${fileName}.csv`)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`측정치를 받지 못했습니다 (${res.status})`)
  return parseFrCsv(await res.text()).curve
}

// splitBrand는 저장된 기기 정리(deviceCleanup.ts)에서도 쓰여서 nameClean.ts로 옮겼다
export { splitBrand }

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
  const source = `${entry.provider === 'squig' ? 'squig.link' : 'AutoEQ'} · ${entry.source}`
  const variant = entry.variant ?? ''
  const existing = await findDeviceByName(entry.name)
  if (existing) {
    const same = (await listMeasurementsByDevice(existing.id)).find(
      (m) => m.source === source && m.variant === variant,
    )
    if (same || !entry.hasCurve) return { result: 'alreadyExists', deviceId: existing.id, measurementId: same?.id }
  }

  // 네트워크에서 먼저 받아 둔다. 실패하면 여기서 오류가 나서 DB에는 아무것도 저장되지 않는다
  const curve = entry.hasCurve ? await fetchCatalogCurve(entry) : null

  const deviceId =
    existing?.id ?? (await addDevice({ ...brandAndModel(entry), category: entry.category, owned, notes: '' }))
  if (!curve) return { result: 'deviceOnly', deviceId }

  const measurementId = await addMeasurement({ deviceId, variant, rig: entry.rig, source, channel: 'avg', curve })
  return { result: existing ? 'measurementAdded' : 'added', deviceId, measurementId }
}

/** 항목의 브랜드·모델. 브랜드를 따로 아는 항목(squig.link)은 그대로, 아니면 이름에서 추정 */
function brandAndModel(entry: CatalogEntry): { brand: string; model: string } {
  if (entry.brand && entry.name.toLowerCase().startsWith(entry.brand.toLowerCase())) {
    return { brand: entry.brand, model: entry.name.slice(entry.brand.length).trim() }
  }
  return splitBrand(entry.name)
}

/** AutoEQ + squig.link 전체 항목. squig.link를 못 받아도 AutoEQ만으로 돌려준다 */
export async function loadAllCatalogEntries(): Promise<CatalogEntry[]> {
  const [autoeq, squig] = await Promise.all([loadCatalog(), loadSquigCatalog().catch(() => [])])
  return [...autoeq, ...squig]
}
