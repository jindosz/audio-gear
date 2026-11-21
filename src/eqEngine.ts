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
  /** global = 폰 전체 출력, sessions = 재생 앱이 보내는 신호로 앱마다 건 경우, apps = 고른 앱에만 */
  mode?: 'global' | 'sessions' | 'apps'
  error?: string
}

/** 폰 EQ를 어느 앱에 걸지. all = 모든 앱(폰 전체), apps = 고른 앱만(그 앱이 재생 신호를 보낼 때만 걸림) */
export type EqTargetMode = 'all' | 'apps'

export interface SeenApp {
  /** 패키지 이름. 예: com.spotify.music */
  package: string
  /** 앱 이름. 예: Spotify */
  label: string
}

export interface EqTargets {
  mode: EqTargetMode
  /** 고른 앱(패키지 이름) */
  apps: string[]
  /** EQ가 켜져 있는 동안 재생 신호를 보낸 적 있는 앱 = 고를 수 있는 앱 */
  seen: SeenApp[]
}

export interface EqEngine {
  kind: 'android' | 'none'
  /** EQ를 건다. 이미 켜져 있으면 바꾼다(끊김 없이). 결과 상태를 돌려준다 */
  apply(name: string, eq: EqSettings): Promise<EqStatus>
  off(): Promise<EqStatus>
  status(): Promise<EqStatus>
  /** 알림에서 끈 경우처럼 앱 밖에서 상태가 바뀌면 알려 준다. 돌려준 함수를 부르면 그만 받는다 */
  onStatus(cb: (s: EqStatus) => void): () => void
  targets(): Promise<EqTargets>
  /** 적용 대상을 바꾼다. EQ가 켜져 있으면 바로 다시 적용된다 */
  setTargets(mode: EqTargetMode, apps: string[]): Promise<void>
}

/** 네이티브 플러그인이 받는 형식(SystemEqPlugin.java와 맞춰야 한다) */
interface SystemEqPlugin {
  apply(options: { name: string; cutoffs: number[]; gains: number[]; inputGain: number }): Promise<void>
  off(): Promise<void>
  status(): Promise<EqStatus>
  addListener(event: 'statusChange', cb: (s: EqStatus) => void): Promise<PluginListenerHandle>
  targets(): Promise<EqTargets>
  setTargets(options: { mode: EqTargetMode; apps: string[] }): Promise<void>
}

const noneEngine: EqEngine = {
  kind: 'none',
  apply: async () => ({ on: false, error: '이 기기에서는 폰 전체 EQ를 쓸 수 없습니다' }),
  off: async () => ({ on: false }),
  status: async () => ({ on: false }),
  onStatus: () => () => {},
  targets: async () => ({ mode: 'all', apps: [], seen: [] }),
  setTargets: async () => {},
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
    async apply(name, eq) {
      const result = nextStatus()
      await plugin.apply({ name, ...toDeviceEq(eq) })
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
    onStatus(cb) {
      subscribe()
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    targets: () => plugin.targets(),
    setTargets: (mode, apps) => plugin.setTargets({ mode, apps }),
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

/** 이 EQ를 폰에 건다(이미 켜져 있으면 끊김 없이 바꿈). 성공하면 무엇을 걸었는지 기억한다 */
export async function applyPreset(id: string, name: string, eq: EqSettings): Promise<EqStatus> {
  const result = await getEqEngine().apply(name, eq)
  setApplied(result.on ? { id, signature: eqSignature(name, eq) } : null)
  return result
}

export async function turnOffPhoneEq(): Promise<EqStatus> {
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
