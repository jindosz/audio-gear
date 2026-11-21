// 화면용 성향 태그: 곡선을 넣으면 태그를 돌려주는 함수를 준다(계산은 soundTags.ts).
// 비교 기준(우선순위):
//  1) 같은 출처("AutoEQ · 측정자" 또는 "squig.link · 사이트")·같은 종류 기기들의 중앙값 — "측정치 미리 받기"로 저장한 요약값에서, 그 출처 기기가 30개 이상일 때
//     (측정자마다 리그·보정이 달라 측정 차이가 태그에 섞이지 않게)
//  2) 없으면 Harman 타깃(처음 한 번 받아 DB에 저장, targets.ts의 ensureTarget)
// 기준을 받는 동안·인터넷이 없어 못 받으면 null(태그를 안 보여줌)
import { useSyncExternalStore } from 'react'
import { categoryLabels } from './labels'
import { readPref, writePref } from './localPrefs'
import { summarySource } from './recommend'
import { listSummaries } from './repo'
import { prepare, SUMMARY_GRID, type Values } from './similarity'
import { medianValues, PEER_MIN, soundTags, tagReferenceId, type SoundTag } from './soundTags'
import { BUILTIN_TARGETS, ensureTarget } from './targets'
import type { DeviceCategory, FrCurve, Rig } from './types'

let version = 0
const subscribers = new Set<() => void>()
const changed = () => {
  version++
  subscribers.forEach((notify) => notify())
}

// ---- 켜고 끄기(설정 → "성향 태그 보기", 이 기기에 기억) ----

const ENABLED_KEY = 'soundTags.on'
let enabled = readPref<boolean>(ENABLED_KEY, true)

export function soundTagsEnabled(): boolean {
  return enabled
}

/** 끄면 그래프·목록·기기 상세·추천 결과의 성향 태그가 모두 사라진다 */
export function setSoundTagsEnabled(on: boolean): void {
  enabled = on
  writePref(ENABLED_KEY, on)
  changed()
}

// ---- 2) Harman 타깃 ----

/** 타깃 id → 비교용으로 다듬은 값. 여러 화면이 함께 쓴다 */
const targetRefs = new Map<string, Values>()
const loadingTargets = new Set<string>()

function loadTarget(id: string) {
  if (targetRefs.has(id) || loadingTargets.has(id)) return
  loadingTargets.add(id)
  ensureTarget(id)
    .then((target) => {
      targetRefs.set(id, prepare(target.curve, SUMMARY_GRID))
      changed()
    })
    .catch(() => {
      // 인터넷이 없으면 이번엔 태그 없이 두고, 다음에 다시 시도한다
    })
    .finally(() => loadingTargets.delete(id))
}

// ---- 1) 같은 측정자 중앙값 ----

interface PeerRefs {
  /** 계산에 쓴 요약값 개수(받는 중이면 늘어남) */
  count: number
  /** 출처(측정치 source 형식) → 그 출처 기기들의 중앙값 */
  bySource: Map<string, Values>
  /** 마지막으로 다시 계산한 시각 */
  at: number
}
const peerRefs = new Map<DeviceCategory, PeerRefs>()
const loadingPeers = new Set<DeviceCategory>()
/** 받는 중에는 요약값이 계속 늘어나서, 너무 자주 다시 계산하지 않게 */
const PEER_REFRESH_MS = 10_000

function loadPeers(category: DeviceCategory) {
  const cached = peerRefs.get(category)
  if (loadingPeers.has(category) || (cached && Date.now() - cached.at < PEER_REFRESH_MS)) return
  loadingPeers.add(category)
  listSummaries(category)
    .then((summaries) => {
      if (cached && cached.count === summaries.length) {
        cached.at = Date.now()
        return
      }
      const groups = new Map<string, Values[]>()
      for (const s of summaries) {
        const key = summarySource(s)
        const list = groups.get(key) ?? []
        list.push(s.values)
        groups.set(key, list)
      }
      const bySource = new Map<string, Values>()
      for (const [source, list] of groups) if (list.length >= PEER_MIN) bySource.set(source, medianValues(list))
      peerRefs.set(category, { count: summaries.length, bySource, at: Date.now() })
      changed()
    })
    .catch(() => {})
    .finally(() => loadingPeers.delete(category))
}

// ---- 화면에서 쓰는 함수 ----

/** 기기 측정치 정보: 곡선(또는 이미 SUMMARY_GRID로 다듬은 값)과 출처(알면) */
export interface TagInput {
  curve?: FrCurve
  values?: Values
  /** 출처(측정치 source 형식, 예: "AutoEQ · oratory1990", "squig.link · 사이트"). 같은 출처 중앙값을 찾는 데 쓴다 */
  source?: string | null
}

/** 성향 태그. 기준을 아직 못 받았으면 null */
export type SoundTagger = (input: TagInput, category: DeviceCategory, rig: Rig) => SoundTag[] | null

/** 곡선 → 다듬은 값(목록 줄을 다시 그릴 때마다 계산하지 않게). 곡선이 지워지면 함께 사라진다 */
const prepared = new WeakMap<FrCurve, Values>()

function prepareCached(curve: FrCurve): Values {
  let v = prepared.get(curve)
  if (!v) {
    v = prepare(curve, SUMMARY_GRID)
    prepared.set(curve, v)
  }
  return v
}

/** 설정 화면용: 지금 켜져 있는지(바뀌면 다시 그림) */
export function useSoundTagsEnabled(): boolean {
  useSyncExternalStore(subscribe, () => version)
  return enabled
}

export function useSoundTagger(): SoundTagger {
  // 기준을 다 받거나 다시 계산하면 version이 바뀌어 화면이 다시 그려진다
  useSyncExternalStore(subscribe, () => version)
  return ({ curve, values, source }, category, rig) => {
    if (!enabled) return null
    const mine = values ?? (curve ? prepareCached(curve) : null)
    if (!mine) return null

    loadPeers(category)
    const peer = source ? peerRefs.get(category)?.bySource.get(source) : undefined
    if (peer) return soundTags(mine, peer, SUMMARY_GRID, `${source} ${categoryLabels[category]} 중앙값`, '평균적')

    const id = tagReferenceId(category, rig)
    const target = targetRefs.get(id)
    if (!target) {
      loadTarget(id)
      return null
    }
    const name = BUILTIN_TARGETS.find((t) => t.id === id)?.name.replace(/ (over-ear|in-ear) \d{4}$/, '') ?? '타깃'
    return soundTags(mine, target, SUMMARY_GRID, name)
  }
}

function subscribe(notify: () => void) {
  subscribers.add(notify)
  return () => subscribers.delete(notify)
}
