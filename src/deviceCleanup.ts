// 이미 저장된 기기의 이름·분류 정리 계획 세우기. 순수 함수(DB를 건드리지 않고 "무엇을 바꿀지"만 계산).
// 실제 적용은 repo.ts의 cleanupStoredDevices가 한다.
//
// 이름 정리 규칙(nameClean.ts)을 만들기 전에 저장된 기기는 "[IEMs] Moondrop Aria"처럼 표기가 그대로 남아 있다.
// 1) 이름을 지금 규칙으로 정리하고, [IEMs] 같은 태그가 있으면 카테고리도 고친다
// 2) 기기가 아닌 이름("------- ---", "(UIEM - FR)")은 지운다
// 3) 정리 후 같은 기기(이름·카테고리가 같음)가 여럿이면 가장 먼저 저장한 기기로 합친다
import { cleanName, splitBrand, stripTag } from './nameClean'
import { normalize } from './text'
import type { Device } from './types'

export interface DeviceUpdate {
  id: string
  brand: string
  model: string
  category: Device['category']
}

export interface DeviceMerge {
  /** 남길 기기 */
  keepId: string
  /** 합쳐서 없앨 기기(측정치는 keepId로 옮긴다) */
  removeIds: string[]
  /** 합친 뒤 keepId에 저장할 값: 보유·찜은 하나라도 켜져 있으면 유지, 메모는 이어 붙이기, 특징은 입력된 쪽 */
  patch: Partial<Device>
}

export interface CleanupPlan {
  updates: DeviceUpdate[]
  deletes: string[]
  merges: DeviceMerge[]
}

/** 저장된 이름 하나를 지금 규칙으로 정리. 기기가 아닌 이름이면 null */
function cleanDevice(d: Device): Omit<DeviceUpdate, 'id'> | null {
  const tagged = stripTag(`${d.brand} ${d.model}`)
  const name = cleanName(tagged.text)
  if (!name) return null
  const category = tagged.category ?? d.category
  // 원래 브랜드가 정리된 이름 앞에 그대로 있으면 그 브랜드를 유지, 아니면 이름에서 다시 나눈다
  const brand = stripTag(d.brand).text.trim()
  if (brand && name.toLowerCase().startsWith(brand.toLowerCase() + ' ')) {
    return { brand: name.slice(0, brand.length), model: name.slice(brand.length).trim(), category }
  }
  return { ...splitBrand(name), category }
}

const hasSpecs = (d: Device) => !!(d.connection || d.acoustic || d.anc || d.codecs?.length)

export function planDeviceCleanup(devices: Device[]): CleanupPlan {
  const plan: CleanupPlan = { updates: [], deletes: [], merges: [] }
  const cleaned = new Map<string, Device>() // 정리 후 모습(합치기 판단용)

  for (const d of devices) {
    const next = cleanDevice(d)
    if (!next) {
      plan.deletes.push(d.id)
      continue
    }
    if (next.brand !== d.brand || next.model !== d.model || next.category !== d.category) {
      plan.updates.push({ id: d.id, ...next })
    }
    cleaned.set(d.id, { ...d, ...next })
  }

  // 같은 기기 묶기: 공백·기호를 지운 이름 + 카테고리
  const groups = new Map<string, Device[]>()
  for (const d of cleaned.values()) {
    const key = `${d.category}:${normalize(`${d.brand} ${d.model}`)}`
    groups.set(key, [...(groups.get(key) ?? []), d])
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const [keep, ...others] = [...group].sort((a, b) => a.createdAt - b.createdAt)
    const withSpecs = [keep, ...others].find(hasSpecs)
    const notes = [...new Set(group.map((d) => d.notes.trim()).filter(Boolean))].join(' / ')
    plan.merges.push({
      keepId: keep.id,
      removeIds: others.map((d) => d.id),
      patch: {
        owned: group.some((d) => d.owned),
        wishlist: group.some((d) => d.wishlist),
        notes,
        ...(withSpecs && withSpecs !== keep
          ? { connection: withSpecs.connection, acoustic: withSpecs.acoustic, anc: withSpecs.anc, codecs: withSpecs.codecs }
          : {}),
      },
    })
  }
  return plan
}
