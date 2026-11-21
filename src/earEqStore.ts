// 내 귀 보정: 결과 저장(이 기기 localStorage `ear.profile`)과 폰에 적용.
// 역치 원값을 저장해서 계산 규칙이 바뀌어도 다시 재지 않아도 되게 한다. 백업에는 넣지 않는다(귀·기기마다 다르고 다시 재면 됨).
// 폰에 거는 일은 eqEngine.ts가 한다: 이 파일이 지금 층(귀마다 127개 dB)을 알려 주면 어떤 EQ든 그 위에 더해서 건다.
// 계산은 earEq.ts(순수 함수)
import { useSyncExternalStore } from 'react'
import { boosts, layerCurve, relativeLoss, type EarLayer, type EarProfile } from './earEq'
import { DEVICE_EQ_FREQS } from './eqDevice'
import { setEarLayerProvider, syncEar } from './eqEngine'
import type { EarResult } from './hearingTest'
import { readPref, writePref } from './localPrefs'

const KEY = 'ear.profile'
let current = readPref<EarProfile | null>(KEY, null)
let cachedLayer: { profile: EarProfile; layer: EarLayer } | null = null
const subscribers = new Set<() => void>()

/** 한 귀의 올릴 양(잰 주파수마다, dB) */
export function earBoosts(ear: EarResult, offset: number[] | null, strength: number): number[] {
  return boosts(relativeLoss(ear.freqs, ear.thresholds), offset, strength, ear.atLimit)
}

/** 프로필 → 귀마다 127개 주파수의 보정 층 */
export function profileLayer(p: EarProfile): EarLayer {
  const side = (ear: EarResult) => layerCurve(ear.freqs, earBoosts(ear, p.offset, p.strength), DEVICE_EQ_FREQS)
  return { left: side(p.left), right: side(p.right) }
}

/** 지금 걸 층(꺼져 있으면 null). 프로필이 바뀔 때만 다시 계산한다 */
export function currentLayer(): EarLayer | null {
  if (!current?.on) return null
  if (cachedLayer?.profile !== current) cachedLayer = { profile: current, layer: profileLayer(current) }
  return cachedLayer.layer
}

// eqEngine이 EQ를 걸 때 층을 물어볼 수 있게 등록(main.tsx가 앱 시작 때 이 파일을 불러옴)
setEarLayerProvider(currentLayer)

function set(next: EarProfile | null) {
  current = next
  writePref(KEY, next)
  subscribers.forEach((n) => n())
}

export function getEarProfile(): EarProfile | null {
  return current
}

export function useEarProfile(): EarProfile | null {
  return useSyncExternalStore(
    (notify) => {
      subscribers.add(notify)
      return () => subscribers.delete(notify)
    },
    () => current,
  )
}

/** 결과를 저장하고 폰에 적용 */
export async function saveEarProfile(p: EarProfile): Promise<void> {
  set(p)
  await syncEar()
}

export async function setEarEqOn(on: boolean): Promise<void> {
  if (!current) return
  set({ ...current, on })
  await syncEar()
}

/** 세기(0~1)를 바꾸고 다시 건다 */
export async function setEarStrength(strength: number): Promise<void> {
  if (!current) return
  set({ ...current, strength })
  await syncEar()
}
