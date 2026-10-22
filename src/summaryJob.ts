// 추천용 데이터 받기: AutoEQ 기기들의 추천 측정치를 뒤에서 하나씩 받아 요약값만 저장한다.
// - 이미 받은 것은 건너뛰어서, 중간에 멈추거나 앱을 껐다 켜도 이어서 받을 수 있다
// - 전체 곡선은 저장하지 않는다(받자마자 요약값으로 줄이고 버림)
// - 진행 상황은 이 파일이 들고 있어서 팝업을 닫았다 열어도 그대로 보인다
import { useSyncExternalStore } from 'react'
import { fetchCatalogCurve, loadCatalogDevices } from './catalog'
import { listSummaryPaths, putSummary } from './repo'
import { prepare, SUMMARY_GRID } from './similarity'
import type { DeviceCategory } from './types'

export interface JobState {
  status: 'idle' | 'running' | 'stopping' | 'done' | 'stopped' | 'error'
  category: DeviceCategory | null
  /** 받을 수 있는 전체 개수(이미 받은 것 포함) */
  total: number
  /** 받아 둔 개수(이미 있던 것 포함) */
  done: number
  /** 받지 못한 개수(파일 없음, 네트워크 오류 등) */
  failed: number
  error?: string
}

/** 동시에 받는 개수. 너무 많으면 GitHub에 부담을 주고, 너무 적으면 느리다 */
const CONCURRENCY = 4

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

export async function startSummaryJob(category: DeviceCategory): Promise<void> {
  if (state.status === 'running' || state.status === 'stopping') return
  setState({ status: 'running', category, total: 0, done: 0, failed: 0, error: undefined })

  try {
    // 측정치가 공개된 기기만(primary가 있는 것) 대상
    const devices = (await loadCatalogDevices()).filter((d) => d.category === category && d.primary)
    const have = new Set(await listSummaryPaths(category))
    const todo = devices.filter((d) => !have.has(d.primary!.path))
    setState({ total: devices.length, done: devices.length - todo.length })

    let next = 0
    // 일꾼(worker) 여러 개가 할 일 목록에서 하나씩 꺼내 처리한다
    const worker = async () => {
      while (state.status === 'running' && next < todo.length) {
        const device = todo[next++]
        const entry = device.primary!
        try {
          const curve = await fetchCatalogCurve(entry)
          await putSummary({
            path: entry.path,
            name: device.name,
            category,
            measurer: entry.source,
            rig: entry.rig,
            values: prepare(curve, SUMMARY_GRID).map(round),
            updatedAt: Date.now(),
          })
          setState({ done: state.done + 1 })
        } catch {
          setState({ failed: state.failed + 1 })
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    // 함수로 읽는 이유: TypeScript는 위에서 'running'으로 바꾼 걸 기억해서, 그 사이 stopSummaryJob이
    // 'stopping'으로 바꿨을 수 있다는 걸 모른다. 함수 호출로 "지금 값"을 다시 읽게 한다
    const stopped = currentStatus() === 'stopping'
    setState({ status: stopped ? 'stopped' : 'done' })
  } catch (err) {
    setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
  }
}

/** 받기를 멈춘다. 지금 받는 중인 몇 개는 마저 받고 멈춘다 */
export function stopSummaryJob() {
  if (state.status === 'running') setState({ status: 'stopping' })
}
