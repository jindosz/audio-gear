// EQ 엔진 창구: "폰(기기) 전체 소리에 EQ 걸기"를 플랫폼마다 다르게 하는 부분을 여기 한 곳에 모은다.
// 화면 코드는 이 파일만 부르고, 안드로이드인지 확인하거나 네이티브 플러그인을 직접 부르지 않는다.
// 나중에 Windows 앱을 붙이면 여기에 구현을 하나 더 넣으면 된다.
// - 안드로이드 앱: 네이티브 플러그인 SystemEq(android/.../SystemEqPlugin.java)
// - 일반 브라우저·PWA: 다른 앱 소리를 바꿀 수 없어 "없음"(화면은 내보내기만 보여준다)
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { useEffect, useState } from 'react'
import { toDeviceEq } from './eqDevice'
import type { EqSettings } from './eqExport'
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
  /** EQ를 건다. 이미 켜져 있으면 바꾼다(끊김 없이). 결과 상태를 돌려준다 */
  apply(name: string, eq: EqSettings): Promise<EqStatus>
  off(): Promise<EqStatus>
  status(): Promise<EqStatus>
  /** 알림에서 끈 경우처럼 앱 밖에서 상태가 바뀌면 알려 준다. 돌려준 함수를 부르면 그만 받는다 */
  onStatus(cb: (s: EqStatus) => void): () => void
}

/** 네이티브 플러그인이 받는 형식(SystemEqPlugin.java와 맞춰야 한다) */
interface SystemEqPlugin {
  apply(options: { name: string; cutoffs: number[]; gains: number[]; inputGain: number }): Promise<void>
  off(): Promise<void>
  status(): Promise<EqStatus>
  addListener(event: 'statusChange', cb: (s: EqStatus) => void): Promise<PluginListenerHandle>
}

const noneEngine: EqEngine = {
  kind: 'none',
  apply: async () => ({ on: false, error: '이 기기에서는 폰 전체 EQ를 쓸 수 없습니다' }),
  off: async () => ({ on: false }),
  status: async () => ({ on: false }),
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
        void plugin.status().then(resolve)
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
