// 추천용 데이터(측정치 미리 받기): 목록 기기들의 측정치를 뒤에서 하나씩 받아 요약값만 저장한다.
// AutoEQ에 있는 기기는 AutoEQ 추천 측정치, squig.link에만 있는 기기는 squig.link 측정치(2026-11-21부터).
// - 이미 받은 것은 건너뛰어서, 중간에 멈추거나 앱을 껐다 켜도 이어서 받을 수 있다
// - 전체 곡선은 저장하지 않는다(받자마자 요약값으로 줄이고 버림)
// - 진행 상황은 이 파일이 들고 있어서 팝업을 닫았다 열어도 그대로 보인다
// - 실패한 것(2026-11-21): 한 바퀴 뒤 3초 쉬고 한 번 더. 그래도 안 되면 목록(meta)에 기억했다가, 앱을 열거나 인터넷이
//   다시 연결될 때 30분이 지났으면 그것만 다시 받는다(retryFailedSummaries). 파일이 없다(404)는 것은 "받을 수 없음"으로
//   따로 기억하고 다시 시도하지 않는다(판단은 summaryRetry.ts)
import { useSyncExternalStore } from 'react'
import { fetchCatalogCurve, groupCatalog, loadAllCatalogEntries } from './catalog'
import { getMeta, listSummaryPaths, putSummary, setMeta } from './repo'
import { prepare, SUMMARY_GRID } from './similarity'
import { isPermanentFailure, retryDue } from './summaryRetry'
import type { DeviceCategory } from './types'

export interface JobState {
  status: 'idle' | 'running' | 'stopping' | 'done' | 'stopped' | 'error'
  category: DeviceCategory | null
  /** 받을 수 있는 전체 개수(이미 받은 것 포함) */
  total: number
  /** 받아 둔 개수(이미 있던 것 포함) */
  done: number
  /** 받지 못한 개수(네트워크 오류 등, 나중에 자동으로 다시 시도) */
  failed: number
  /** 다시 시도한 것만 받는 중인지(앱을 열 때 자동으로) */
  retrying?: boolean
  /** [전체 받기]에서 이 다음에 받을 종류들 */
  queued?: DeviceCategory[]
  error?: string
}

/** 동시에 받는 개수. 너무 많으면 측정 사이트에 부담을 주고, 너무 적으면 느리다(squig.link는 여러 사이트로 흩어짐) */
const CONCURRENCY = 6

let state: JobState = { status: 'idle', category: null, total: 0, done: 0, failed: 0 }
const listeners = new Set<() => void>()

function setState(patch: Partial<JobState>) {
  state = { ...state, ...patch }
  listeners.forEach((notify) => notify())
}

const currentStatus = () => state.status

export function useSummaryJob(): JobState {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => state,
  )
}

/** 소수 첫째 자리까지 반올림(저장 용량 절약. 0.1dB 차이는 들리지 않는다) */
const round = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10)

// ---- 실패 목록(meta에 경로를 쉼표 대신 JSON 배열로) ----

/** 일시 실패: 나중에 다시 시도할 경로들 */
export const retryKey = (category: DeviceCategory) => `summary.retry.${category}`
/** 영구 실패(파일 없음): 다시 시도하지 않는 경로들 */
export const goneKey = (category: DeviceCategory) => `summary.gone.${category}`

async function readList(key: string): Promise<{ paths: string[]; at: number | null }> {
  const record = await getMeta(key)
  if (!record) return { paths: [], at: null }
  try {
    const paths = JSON.parse(record.value) as unknown
    return { paths: Array.isArray(paths) ? paths.map(String) : [], at: record.updatedAt }
  } catch {
    return { paths: [], at: record.updatedAt }
  }
}

const writeList = (key: string, paths: string[]) => setMeta(key, JSON.stringify(paths))

interface StartOptions {
  /** 이 경로들만 받는다(나중에 다시 시도할 때) */
  only?: string[]
}

export async function startSummaryJob(category: DeviceCategory, options: StartOptions = {}): Promise<void> {
  if (state.status === 'running' || state.status === 'stopping') return
  setState({ status: 'running', category, total: 0, done: 0, failed: 0, error: undefined, retrying: !!options.only })

  try {
    // 측정치가 공개된 기기만(primary가 있는 것) 대상. squig.link 목록을 못 받으면 AutoEQ만으로.
    // 파일이 없다고 확인된 것(영구 실패)은 뺀다
    const gone = new Set((await readList(goneKey(category))).paths)
    const devices = groupCatalog(await loadAllCatalogEntries()).filter(
      (d) => d.category === category && d.primary && !gone.has(d.primary.path),
    )
    const have = new Set(await listSummaryPaths(category))
    const missing = devices.filter((d) => !have.has(d.primary!.path))
    const only = options.only ? new Set(options.only) : null
    const todo = only ? missing.filter((d) => only.has(d.primary!.path)) : missing
    setState({ total: devices.length, done: devices.length - missing.length })

    /** 이번에 실패한 것: 일시(다시 시도)·영구(파일 없음) */
    let transient: typeof todo = []
    const permanent: string[] = []
    /** 실제로 시도한 것(멈추면 일부만 시도함) */
    const attempted = new Set<string>()
    // 일꾼(worker) 여러 개가 할 일 목록에서 하나씩 꺼내 처리한다
    const runPass = async (list: typeof todo) => {
      let next = 0
      const worker = async () => {
        while (state.status === 'running' && next < list.length) {
          const device = list[next++]
          const entry = device.primary!
          attempted.add(entry.path)
          try {
            const curve = await fetchCatalogCurve(entry)
            await putSummary({
              path: entry.path,
              provider: entry.provider,
              ...(entry.files ? { files: entry.files } : {}),
              name: device.name,
              category,
              measurer: entry.source,
              rig: entry.rig,
              values: prepare(curve, SUMMARY_GRID).map(round),
              updatedAt: Date.now(),
            })
            setState({ done: state.done + 1 })
          } catch (err) {
            if (isPermanentFailure(err)) permanent.push(entry.path)
            else transient.push(device)
          }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    }

    await runPass(todo)
    // 한 바퀴 뒤 일시 실패한 것만 잠깐 쉬고 한 번 더(잠깐 끊긴 네트워크는 대개 여기서 해결)
    if (transient.length > 0 && currentStatus() === 'running') {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      const again = transient
      transient = []
      await runPass(again)
    }
    setState({ failed: transient.length })

    // 남은 일시 실패는 나중에 다시 시도하려고, 영구 실패는 다시 시도하지 않으려고 기억해 둔다.
    // 다시 시도 목록은 이번에 시도한 범위 안에서만 바꾼다(멈춰서 못 받은 것은 [이어 받기]가 맡음)
    const previous = (await readList(retryKey(category))).paths
    const stillFailed = transient.map((d) => d.primary!.path)
    await writeList(retryKey(category), [...previous.filter((p) => !attempted.has(p)), ...stillFailed])
    if (permanent.length) await writeList(goneKey(category), [...gone, ...permanent])
    // 함수로 읽는 이유: TypeScript는 위에서 'running'으로 바꾼 걸 기억해서, 그 사이 stopSummaryJob이
    // 'stopping'으로 바꿨을 수 있다는 걸 모른다. 함수 호출로 "지금 값"을 다시 읽게 한다
    const stopped = currentStatus() === 'stopping'
    setState({ status: stopped ? 'stopped' : 'done' })
  } catch (err) {
    setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
  }
}

/**
 * 예전에 일시 실패한 것만 다시 받는다(앱을 열 때·인터넷이 다시 연결될 때 App이 부름).
 * 인터넷이 없거나, 다른 받기가 진행 중이거나, 마지막 시도에서 30분이 안 지났으면 그냥 지나간다
 */
export async function retryFailedSummaries(): Promise<void> {
  for (const category of ['headphone', 'iem'] as const) {
    if (!navigator.onLine || state.status === 'running' || state.status === 'stopping') return
    const { paths, at } = await readList(retryKey(category))
    if (paths.length === 0 || !retryDue(at, Date.now())) continue
    await startSummaryJob(category, { only: paths })
  }
}

/**
 * [전체 받기]: 헤드폰 → 이어폰을 차례로 받는다(이미 받은 것은 건너뜀).
 * 하나를 끝까지 받으면 다음으로 넘어가고, 멈추거나 오류가 나면 남은 차례도 멈춘다
 */
export async function startAllSummaryJobs(): Promise<void> {
  if (state.status === 'running' || state.status === 'stopping') return
  const order: DeviceCategory[] = ['headphone', 'iem']
  for (let i = 0; i < order.length; i++) {
    setState({ queued: order.slice(i + 1) })
    await startSummaryJob(order[i])
    setState({ queued: order.slice(i + 1) })
    if (currentStatus() !== 'done') break
  }
  setState({ queued: [] })
}

/** 받기를 멈춘다. 지금 받는 중인 몇 개는 마저 받고 멈춘다([전체 받기]의 남은 차례도) */
export function stopSummaryJob() {
  if (state.status === 'running') setState({ status: 'stopping', queued: [] })
}
