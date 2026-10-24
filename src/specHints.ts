// 기기 주요 특징(연결·구조·ANC·코덱) 추정값 찾기.
// - 헤드폰: data/headphoneHints.ts의 시리즈 규칙(이름 앞부분이 맞는 가장 긴 규칙)
// - 이어폰: 이름에 무선이라는 확실한 단서가 있을 때만(AirPods, Galaxy Buds, Sony WF-, TWS 등)
// 확실하지 않으면 undefined. 추정값은 사용자가 확인(적용)하기 전까지 기기 데이터에 저장하지 않는다.
import { HEADPHONE_HINTS, type SpecHint } from './data/headphoneHints'
import { hasSpecs, specTags, type Specs } from './labels'
import { normalize } from './text'
import type { DeviceCategory } from './types'

export type { SpecHint }

// 긴 키부터 검사해야 더 구체적인 규칙이 이긴다
const RULES: [string, SpecHint][] = HEADPHONE_HINTS.map(([key, hint]): [string, SpecHint] => [normalize(key), hint]).sort(
  (a, b) => b[0].length - a[0].length,
)

/** 이어폰 이름 속 무선(완전 무선) 단서. ANC 단서가 함께 있으면 ANC도 표시 */
const IEM_WIRELESS: RegExp[] = [
  /\bAirPods\b(?! Max)/i,
  /\bGalaxy Buds/i,
  /\bPixel Buds/i,
  /\bSony WF-/i,
  /\bTrue Wireless\b/i,
  /\bTWS\b/i,
  /\bTechnics EAH-AZ/i,
  /\bBose QuietComfort (Ultra )?Earbuds/i,
  /\bBeats (Studio Buds|Fit Pro|Solo Buds|Powerbeats Pro)/i,
  /\bPowerbeats Pro\b/i,
  /\bJabra Elite \d+t\b/i,
  /\bNothing Ear\b/i,
  /\bSoundcore Liberty/i,
  /\bHuawei FreeBuds/i,
]
const IEM_ANC = /\bAirPods Pro\b|\bANC\b|\bNoise Cancell?ing\b|\bQuietComfort\b|\bWF-1000XM/i

export function specHint(name: string, category: DeviceCategory): SpecHint | undefined {
  if (category === 'headphone') {
    const key = normalize(name)
    const rule = RULES.find(([prefix]) => key.startsWith(prefix))
    // 빈 규칙({})은 "일부러 비워 둠"(예: 오픈·밀폐 전환형)이라 결과도 없음으로 본다
    return rule && Object.keys(rule[1]).length > 0 ? rule[1] : undefined
  }
  if (IEM_WIRELESS.some((re) => re.test(name))) {
    return { connection: 'wireless', ...(IEM_ANC.test(name) ? { anc: true } : {}) }
  }
  return undefined
}

/**
 * 화면에 보여줄 특징: 입력된 값이 있으면 그것, 없으면 추정값(estimated: true).
 * 입력값과 추정값을 섞지 않는다(일부만 입력했어도 입력한 쪽을 믿는다)
 */
export function displaySpecs(
  device: Specs & { brand: string; model: string; category: DeviceCategory },
): { tags: string[]; estimated: boolean } {
  if (hasSpecs(device)) return { tags: specTags(device), estimated: false }
  const hint = specHint(`${device.brand} ${device.model}`, device.category)
  return { tags: hint ? specTags(hint) : [], estimated: !!hint }
}
