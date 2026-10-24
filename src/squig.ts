// squig.link 목록을 카탈로그에 더하는 코드.
// squig.link는 리뷰어 120여 곳이 각자 측정치를 올려 두는 사이트 모음이다(https://squig.link).
// - 사이트 목록: squig.link/squigsites.json
// - 사이트별 기기 목록: <사이트 주소>/data/phone_book.json
// - 측정치: <사이트 주소>/data/<파일 이름> L.txt, R.txt (REW 텍스트 형식, 왼쪽·오른쪽)
// 모두 CORS를 허용해서 브라우저에서 바로 받을 수 있다.
// 측정치의 권리는 각 리뷰어에게 있으므로 AutoEQ처럼 고를 때만 받고, 출처(사이트 이름)를 붙여 저장한다.
import type { CatalogEntry } from './catalog'
import { cleanName, cleanPart } from './nameClean'
import { getMeta, setMeta } from './repo'
import type { DeviceCategory, Rig } from './types'

const SITES_URL = 'https://squig.link/squigsites.json'
const CACHE_KEY = 'squig.catalog'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const CONCURRENCY = 8

/**
 * 제외하는 사이트. crinacle(graph.hangout.audio)은 측정치를 다른 곳에서 가져다 쓰는 것을 원하지 않아
 * AutoEQ에서도 CSV를 내렸다. 그 뜻을 존중해 여기서도 쓰지 않는다
 */
const EXCLUDED_SITES = new Set(['crinacle'])

interface SquigSite {
  username: string
  name: string
  urlType: 'subdomain' | 'labFolder' | 'altDomain' | 'root'
  altDomain?: string
  dbs?: { type: string; folder: string }[]
}

/** 보관용으로 줄인 사이트 DB 하나: 기기마다 [브랜드, 모델, 파일 이름, 구성 설명] */
interface StoredDb {
  siteName: string
  /** 측정치 파일이 있는 주소(끝에 /data/ 포함) */
  dataUrl: string
  category: DeviceCategory
  rig: Rig
  phones: [string, string, string, string][]
}

function siteBase(site: SquigSite): string | null {
  if (site.urlType === 'subdomain') return `https://${site.username}.squig.link`
  if (site.urlType === 'root') return 'https://squig.link'
  if (site.urlType === 'labFolder') return `https://squig.link/lab/${site.username}`
  if (site.urlType === 'altDomain' && site.altDomain) return site.altDomain.replace(/\/$/, '')
  return null
}

/** 사이트 DB 종류 → 카테고리. 5128 DB는 폴더 이름에 headphones가 있으면 헤드폰 */
function toCategory(type: string, folder: string): DeviceCategory {
  if (type === 'Headphones') return 'headphone'
  if (type === '5128' && /headphone/i.test(folder)) return 'headphone'
  return 'iem'
}

/** 사이트 설정(config.js)의 리그 설명 → 리그. 적혀 있지 않은 사이트가 대부분이라 그때는 'other' */
function toRig(type: string, description: string): Rig {
  if (type === '5128' || /5128/.test(description)) return '5128'
  if (/711|60318-4/.test(description)) return '711'
  if (/GRAS|43AG|45CA|KEMAR/i.test(description)) return 'gras'
  return 'other'
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json() as Promise<T>
}

interface PhoneBookBrand {
  name: string
  phones?: { name: string; file: string | string[]; suffix?: string | string[] }[]
}

export interface SquigProgress {
  done: number
  total: number
}

/** 모든 사이트의 기기 목록을 받아 보관용 형태로 줄인다. 실패한 사이트는 건너뛴다 */
async function downloadAll(onProgress?: (p: SquigProgress) => void): Promise<StoredDb[]> {
  const sites = await fetchJson<SquigSite[]>(SITES_URL)
  const jobs = sites.flatMap((site) => {
    const base = siteBase(site)
    if (!base || EXCLUDED_SITES.has(site.username)) return []
    return (site.dbs ?? []).map((db) => ({ site, db, url: `${base}${db.folder}` }))
  })
  const result: StoredDb[] = []
  let next = 0
  let done = 0
  onProgress?.({ done, total: jobs.length })

  const worker = async () => {
    while (next < jobs.length) {
      const { site, db, url } = jobs[next++]
      try {
        const book = await fetchJson<PhoneBookBrand[]>(`${url}data/phone_book.json`)
        // 리그 설명은 있으면 좋고, 없거나 못 받아도 괜찮다
        const config = await fetch(`${url}config.js`, { signal: AbortSignal.timeout(20000) })
          .then((r) => (r.ok ? r.text() : ''))
          .catch(() => '')
        const rigDescription = config.match(/rig_description\s*=\s*["'`]([^"'`]*)["'`]/)?.[1] ?? ''
        const phones: StoredDb['phones'] = []
        for (const brand of book) {
          for (const phone of brand.phones ?? []) {
            const files = Array.isArray(phone.file) ? phone.file : [phone.file]
            const suffixes = Array.isArray(phone.suffix) ? phone.suffix : [phone.suffix ?? '']
            // 한 기기에 파일이 여러 개면 구성(팁·패드·ANC 등)이 다른 측정이다
            files.forEach((file, i) => phones.push([brand.name, phone.name, file, files.length > 1 ? (suffixes[i] ?? '') : '']))
          }
        }
        result.push({
          siteName: site.name,
          dataUrl: `${url}data/`,
          category: toCategory(db.type, db.folder),
          rig: toRig(db.type, rigDescription),
          phones,
        })
      } catch {
        // 사이트가 닫혔거나 형식이 다르면 건너뛴다
      }
      onProgress?.({ done: ++done, total: jobs.length })
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return result
}

/**
 * 이름 앞의 [태그]를 떼고, 태그가 종류를 알려주면 카테고리로 쓴다.
 * 예) "[IEMs] Moondrop Space Travel 2" → 이어폰, "[Unbranded]" → "Unbranded"
 * 헤드폰 목록 안에 이어폰을 섞어 두고 태그로만 표시하는 사이트가 있어서 필요하다
 */
function stripTag(text: string): { text: string; category?: DeviceCategory } {
  const match = text.match(/^\s*\[([^\]]*)\]\s*/)
  if (!match) return { text: text.trim() }
  const tag = match[1]
  const rest = text.slice(match[0].length).trim()
  const category: DeviceCategory | undefined = /iem|in-?ear|earphone|earbud|tws/i.test(tag)
    ? 'iem'
    : /headphone|over-?ear|on-?ear/i.test(tag)
      ? 'headphone'
      : undefined
  // 종류를 알려주는 태그는 떼어 내고, 그 밖의 태그(예: Unbranded)는 괄호만 지워 이름으로 남긴다
  return { text: category ? rest : `${tag} ${rest}`.trim(), category }
}

/** 이름 안에 이어폰이라는 표시가 있는지(예: "Something (IEM)") */
const IEM_IN_NAME = /\b(IEMs?|TWS|in-?ear monitor)\b/i

/** 보관본 → 카탈로그 항목 */
function toEntries(dbs: StoredDb[]): CatalogEntry[] {
  const entries: CatalogEntry[] = []
  for (const db of dbs) {
    for (const [rawBrand, rawModel, rawFile, rawVariant] of db.phones) {
      // 사이트마다 목록을 손으로 만들어서, 이름이 숫자로 적혀 있는 경우도 있다 → 모두 글자로 바꿔 쓴다
      const b = stripTag(String(rawBrand ?? ''))
      const m = stripTag(String(rawModel ?? ''))
      const brand = cleanPart(b.text)
      const model = cleanPart(m.text)
      const file = String(rawFile ?? '')
      const variant = cleanName(String(rawVariant ?? '')) ?? ''
      if (!model || !file) continue
      // 모델 이름에 브랜드가 이미 들어 있는 사이트도 있다. 표기 정리와 기기가 아닌 줄 걸러 내기는 nameClean.ts
      const name = cleanName(!brand || model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${brand} ${model}`)
      if (!name) continue
      // 분류: 이름 태그 → 이름 속 표시 → 사이트 목록 종류 순으로 믿는다
      const category = m.category ?? b.category ?? (IEM_IN_NAME.test(name) ? 'iem' : db.category)
      entries.push({
        provider: 'squig',
        name,
        brand,
        variant,
        source: db.siteName,
        rigName: '',
        rig: db.rig,
        category,
        path: `squig:${db.dataUrl}${file}`,
        files: [`${db.dataUrl}${encodeURIComponent(`${file} L.txt`)}`, `${db.dataUrl}${encodeURIComponent(`${file} R.txt`)}`],
        hasCurve: true,
        recommended: false,
      })
    }
  }
  return entries
}

let squigPromise: Promise<CatalogEntry[]> | null = null

// 진행 상황을 듣는 함수들. 여러 화면이 같은 받기 작업을 기다릴 수 있어서 하나가 아니라 목록으로 둔다
let progress: SquigProgress | null = null
const progressListeners = new Set<(p: SquigProgress) => void>()
function reportProgress(p: SquigProgress) {
  progress = p
  progressListeners.forEach((listen) => listen(p))
}

/** 처음 받기의 진행 상황을 구독한다. 돌려받은 함수를 부르면 구독을 끊는다 */
export function onSquigProgress(listen: (p: SquigProgress) => void): () => void {
  progressListeners.add(listen)
  if (progress) listen(progress)
  return () => progressListeners.delete(listen)
}

/**
 * squig.link 카탈로그. 보관본이 있으면 바로 쓰고(7일 지나면 뒤에서 새로 받음), 없으면 받아서 보관한다.
 * 처음 받을 때는 사이트 140여 곳의 목록(약 6MB)을 받느라 30초쯤 걸릴 수 있어 진행 상황을 알려준다(onSquigProgress)
 */
export function loadSquigCatalog(): Promise<CatalogEntry[]> {
  squigPromise ??= (async () => {
    const saved = await getMeta(CACHE_KEY)
    if (saved) {
      if (Date.now() - saved.updatedAt > MAX_AGE_MS) {
        downloadAll()
          .then(async (dbs) => {
            if (dbs.length) await setMeta(CACHE_KEY, JSON.stringify(dbs))
          })
          .catch(() => {})
      }
      return toEntries(JSON.parse(saved.value) as StoredDb[])
    }
    const dbs = await downloadAll(reportProgress)
    if (dbs.length === 0) throw new Error('squig.link 목록을 받지 못했습니다.')
    await setMeta(CACHE_KEY, JSON.stringify(dbs))
    return toEntries(dbs)
  })().catch((err) => {
    squigPromise = null
    throw err
  })
  return squigPromise
}
