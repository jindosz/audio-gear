// 내 귀 균형: 저장(이 기기 localStorage)과 폰에 적용.
// 값 하나(dB)만 있어서 백업에 넣지 않는다(귀·기기마다 다르고 다시 재면 됨).
// 폰에 거는 일은 eqEngine.ts가 한다: EQ를 걸 때 균형 값을 함께 넘기고, EQ를 끄면 균형만 남긴다.
// 계산은 earBalance.ts(순수 함수)
import { useSyncExternalStore } from 'react'
import { applyBalanceOnly, EAR_BALANCE_NAME, getEqEngine, setBalanceProvider, turnOffPhoneEq } from './eqEngine'
import { readPref, writePref } from './localPrefs'

export interface EarBalance {
  /** "오른쪽을 왼쪽보다 몇 dB 크게"(earBalance.ts 참고) */
  db: number
  /** 폰에 적용할지 */
  on: boolean
  /** 잰 날짜(ISO) */
  measuredAt: string
}

const KEY = 'ear.balance'
let current = readPref<EarBalance | null>(KEY, null)
const subscribers = new Set<() => void>()

// eqEngine이 EQ를 걸 때 균형 값을 물어볼 수 있게 등록(main.tsx가 앱 시작 때 이 파일을 불러옴)
setBalanceProvider({
  db: () => (current?.on ? current.db : 0),
  on: () => !!current?.on,
})

function set(next: EarBalance | null) {
  current = next
  writePref(KEY, next)
  subscribers.forEach((n) => n())
}

export function getEarBalance(): EarBalance | null {
  return current
}

export function useEarBalance(): EarBalance | null {
  return useSyncExternalStore(
    (notify) => {
      subscribers.add(notify)
      return () => subscribers.delete(notify)
    },
    () => current,
  )
}

/** 잰 결과를 저장하고 켠 뒤 폰에 적용 */
export async function saveEarBalance(db: number): Promise<void> {
  set({ db, on: true, measuredAt: new Date().toISOString() })
  await syncEarBalance()
}

export async function setEarBalanceOn(on: boolean): Promise<void> {
  if (!current) return
  set({ ...current, on })
  await syncEarBalance()
}

/**
 * 지금 폰 상태에 균형 설정을 맞춘다.
 * - EQ가 걸려 있으면 균형 값만 바꿈(EQ 그대로). 균형만 걸린 상태에서 균형을 끄면 다 끔
 * - 아무것도 안 걸려 있고 균형이 켜져 있으면 균형만 건다
 */
export async function syncEarBalance(): Promise<void> {
  const engine = getEqEngine()
  if (engine.kind === 'none') return
  const status = await engine.status()
  const on = !!current?.on
  if (status.on) {
    if (status.name === EAR_BALANCE_NAME && !on) await turnOffPhoneEq()
    else await engine.setBalance(on && current ? current.db : 0)
  } else if (on) {
    await applyBalanceOnly()
  }
}
