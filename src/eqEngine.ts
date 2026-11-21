// EQ 엔진 창구: "폰(기기) 전체 소리에 EQ 걸기"를 플랫폼마다 다르게 하는 부분을 여기 한 곳에 모은다.
// 화면 코드는 이 파일만 부르고, 안드로이드인지 확인하거나 네이티브 플러그인을 직접 부르지 않는다.
// 나중에 Windows 앱을 붙이면 여기에 구현을 하나 더 넣으면 된다.
// - 안드로이드 앱: 네이티브 플러그인 SystemEq(android/.../SystemEqPlugin.java)
// - 일반 브라우저·PWA: 다른 앱 소리를 바꿀 수 없어 "없음"(화면은 내보내기만 보여준다)
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { useEffect, useState } from 'react'
import { toDeviceEq } from './eqDevice'
import type { EqSettings } from './eqExport'
import { EQ_APPLIED_KEY, readPref, writePref } from './localPrefs'
import { isAndroidApp } from './platform'

export interface EqStatus {
  on: boolean
  /** 지금 걸려 있는 EQ 이름 */
  name?: string
  /** global = 폰 전체 출력, sessions = 재생 앱이 보내는 신호로 앱마다 건 경우 */
  mode?: 'global' | 'sessions'
  error?: string
}

export interface EqEngine {
  kind: 'android' | 'none'
  /**
   * EQ를 건다. 이미 켜져 있으면 바꾼다(끊김 없이). 결과 상태를 돌려준다.
   * balanceDb: 내 귀 균형(earBalance.ts의 값, 0이면 없음). 큰 쪽 채널만 줄인다
   */
  apply(name: string, eq: EqSettings, balanceDb?: number): Promise<EqStatus>
  off(): Promise<EqStatus>
  status(): Promise<EqStatus>
  /** 켜져 있으면 균형 값만 바꾼다(EQ는 그대로). 꺼져 있으면 아무것도 안 함 */
  setBalance(db: number): Promise<void>
  /** true면 걸린 효과를 잠깐 끈다(내 귀 균형 시험 중). 저장하지 않음 */
  setBypass(on: boolean): Promise<void>
  /** 알림에서 끈 경우처럼 앱 밖에서 상태가 바뀌면 알려 준다. 돌려준 함수를 부르면 그만 받는다 */
  onStatus(cb: (s: EqStatus) => void): () => void
}

/** 네이티브 플러그인이 받는 형식(SystemEqPlugin.java와 맞춰야 한다) */
interface SystemEqPlugin {
  apply(options: { name: string; cutoffs: number[]; gains: number[]; inputGain: number; balanceDb: number }): Promise<void>
  setBalance(options: { balanceDb: number }): Promise<void>
  setBypass(options: { on: boolean }): Promise<void>
  off(): Promise<void>
  status(): Promise<EqStatus>
  addListener(event: 'statusChange', cb: (s: EqStatus) => void): Promise<PluginListenerHandle>
}

const noneEngine: EqEngine = {
  kind: 'none',
  apply: async () => ({ on: false, error: '이 기기에서는 폰 전체 EQ를 쓸 수 없습니다' }),
  off: async () => ({ on: false }),
  status: async () => ({ on: false }),
  setBalance: async () => {},
  setBypass: async () => {},
  onStatus: () => () => {},
}

/** 네이티브 쪽은 EQ를 건 결과를 이벤트로 알려 준다. 응답을 이만큼 기다린 뒤에는 상태를 직접 묻는다 */
const RESULT_TIMEOUT_MS = 3000

function androidEngine(): EqEngine {
  const plugin = registerPlugin<SystemEqPlugin>('SystemEq')
  const listeners = new Set<(s: EqStatus) => void>()
  let subscribed = false

  function subscribe() {
    if (subscribed) return
    subscribed = true
    void plugin.addListener('statusChange', (s) => listeners.forEach((l) => l(s)))
  }

  /** 다음 상태 바뀜(이벤트)을 기다린다. 오지 않으면 상태를 직접 묻는다 */
  function nextStatus(): Promise<EqStatus> {
    subscribe()
    return new Promise((resolve) => {
      const done = (s: EqStatus) => {
        clearTimeout(timer)
        listeners.delete(done)
        resolve(s)
      }
      const timer = setTimeout(() => {
        listeners.delete(done)
        // 상태 묻기마저 실패해도 버튼이 "적용 중…"에 멈추지 않게 반드시 끝낸다
        plugin
          .status()
          .then(resolve)
          .catch(() => resolve({ on: false, error: '폰 EQ 상태를 알 수 없습니다' }))
      }, RESULT_TIMEOUT_MS)
      listeners.add(done)
    })
  }

  return {
    kind: 'android',
    async apply(name, eq, balanceDb = 0) {
      const result = nextStatus()
      await plugin.apply({ name, ...toDeviceEq(eq), balanceDb })
      return result
    },
    async off() {
      const current = await plugin.status()
      if (!current.on) return current
      const result = nextStatus()
      await plugin.off()
      return result
    },
    status: () => plugin.status(),
    setBalance: (db) => plugin.setBalance({ balanceDb: db }),
    setBypass: (on) => plugin.setBypass({ on }),
    onStatus(cb) {
      subscribe()
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}

let engine: EqEngine | null = null

export function getEqEngine(): EqEngine {
  engine ??= isAndroidApp() ? androidEngine() : noneEngine
  return engine
}

/** 화면용: 지금 폰 EQ 상태. 처음 읽기 전에는 null */
export function useEqStatus(): EqStatus | null {
  const [status, setStatus] = useState<EqStatus | null>(null)
  useEffect(() => {
    const e = getEqEngine()
    let alive = true
    void e.status().then((s) => alive && setStatus(s))
    const stop = e.onStatus(setStatus)
    return () => {
      alive = false
      stop()
    }
  }, [])
  return status
}

// ---- 어떤 EQ를 어떤 값으로 걸었는지(화면 표시용) ----
// 폰에 걸린 값과 지금 편집 중인 값이 다르면 "변경 사항 적용"을 보여 주려고, 건 EQ의 id와 값 서명을 기억한다

export interface AppliedEq {
  /** 건 EQ의 id(eqPresets) */
  id: string
  /** 건 값(이름·필터·프리앰프)의 서명. 지금 값과 비교한다 */
  signature: string
}

/** 이름·필터·프리앰프가 같으면 같은 문자열 */
export function eqSignature(name: string, eq: EqSettings): string {
  return JSON.stringify([name, eq.filters, eq.preamp])
}

let applied: AppliedEq | null = readPref<AppliedEq | null>(EQ_APPLIED_KEY, null)
const appliedListeners = new Set<() => void>()

function setApplied(next: AppliedEq | null) {
  applied = next
  writePref(EQ_APPLIED_KEY, next)
  appliedListeners.forEach((l) => l())
}

// ---- 내 귀 균형(earBalanceStore.ts가 값을 알려 준다. 이 파일이 스토어를 import하면 서로 물려서 거꾸로 등록받음) ----

/** 균형만 걸려 있을 때(EQ 없이) 폰 상태·알림에 보이는 이름 */
export const EAR_BALANCE_NAME = '내 귀 균형'

interface BalanceProvider {
  /** 지금 걸 균형 값(꺼져 있으면 0) */
  db(): number
  /** 균형이 켜져 있는지 */
  on(): boolean
}
let balanceProvider: BalanceProvider = { db: () => 0, on: () => false }

export function setBalanceProvider(p: BalanceProvider): void {
  balanceProvider = p
}

/** 평평한 EQ로 균형만 건다 */
export async function applyBalanceOnly(): Promise<EqStatus> {
  const result = await getEqEngine().apply(EAR_BALANCE_NAME, { filters: [], preamp: 0 }, balanceProvider.db())
  setApplied(null)
  return result
}

/** 이 EQ를 폰에 건다(이미 켜져 있으면 끊김 없이 바꿈). 성공하면 무엇을 걸었는지 기억한다 */
export async function applyPreset(id: string, name: string, eq: EqSettings): Promise<EqStatus> {
  const result = await getEqEngine().apply(name, eq, balanceProvider.db())
  setApplied(result.on ? { id, signature: eqSignature(name, eq) } : null)
  return result
}

/** EQ 끄기. 내 귀 균형이 켜져 있으면 다 끄지 않고 균형만 남긴다 */
export async function turnOffPhoneEq(): Promise<EqStatus> {
  if (balanceProvider.on()) return applyBalanceOnly()
  const result = await getEqEngine().off()
  if (!result.on) setApplied(null)
  return result
}

/** 화면용: 마지막으로 건 EQ. 폰 EQ가 꺼져 있으면(알림에서 끈 경우 등) null */
export function useAppliedEq(status: EqStatus | null): AppliedEq | null {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force((n) => n + 1)
    appliedListeners.add(l)
    return () => {
      appliedListeners.delete(l)
    }
  }, [])
  return status?.on ? applied : null
}
