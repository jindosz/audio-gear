// 화면용 성향 태그: 기준 타깃(Harman 등)을 처음 한 번 받아 두고(targets.ts의 ensureTarget, DB에 저장됨),
// 곡선을 넣으면 태그를 돌려주는 함수를 준다. 기준을 받는 동안·인터넷이 없어 못 받으면 null(태그를 안 보여줌)
import { useSyncExternalStore } from 'react'
import { prepare, SUMMARY_GRID, type Values } from './similarity'
import { soundTags, tagReferenceId, type SoundTag } from './soundTags'
import { BUILTIN_TARGETS, ensureTarget } from './targets'
import type { DeviceCategory, FrCurve, Rig } from './types'

/** 타깃 id → 비교용으로 다듬은 값. 여러 화면이 함께 쓴다 */
const references = new Map<string, Values>()
const loading = new Set<string>()
let version = 0
const subscribers = new Set<() => void>()

function load(id: string) {
  if (references.has(id) || loading.has(id)) return
  loading.add(id)
  ensureTarget(id)
    .then((target) => {
      references.set(id, prepare(target.curve, SUMMARY_GRID))
      version++
      subscribers.forEach((notify) => notify())
    })
    .catch(() => {
      // 인터넷이 없으면 이번엔 태그 없이 두고, 다음에 다시 시도한다
    })
    .finally(() => loading.delete(id))
}

function subscribe(notify: () => void) {
  subscribers.add(notify)
  return () => subscribers.delete(notify)
}

/** 곡선(또는 이미 SUMMARY_GRID로 다듬은 값) → 성향 태그. 기준을 아직 못 받았으면 null */
export type SoundTagger = (input: { curve?: FrCurve; values?: Values }, category: DeviceCategory, rig: Rig) => SoundTag[] | null

export function useSoundTagger(): SoundTagger {
  // 기준 타깃을 다 받으면 version이 바뀌어 화면이 다시 그려진다
  useSyncExternalStore(subscribe, () => version)
  return ({ curve, values }, category, rig) => {
    const id = tagReferenceId(category, rig)
    const reference = references.get(id)
    if (!reference) {
      load(id)
      return null
    }
    const mine = values ?? (curve ? prepare(curve, SUMMARY_GRID) : null)
    if (!mine) return null
    const name = BUILTIN_TARGETS.find((t) => t.id === id)?.name.replace(/ (over-ear|in-ear) \d{4}$/, '') ?? '타깃'
    return soundTags(mine, reference, SUMMARY_GRID, name)
  }
}
