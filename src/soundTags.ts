// 성향 태그(순수 함수): FR 곡선을 기준 타깃(Harman 등)과 비교해 "저음 강함", "고음 어두움", "치찰음 피크" 같은 짧은 말로.
// 그래프를 읽지 않아도 소리를 짐작할 수 있게 목록·그래프·추천 결과에 붙인다.
// 값은 prepare(곡선, SUMMARY_GRID)를 거친 것(300Hz~3kHz 평균 = 0dB, 1/6옥타브 스무딩)을 쓴다.
// 왜 기준과 비교하나: 사람 귀 때문에 거의 모든 기기가 3kHz 근처가 솟아 있어서, 곡선만 보면 다 "중고음 쏨"이 된다.
// 기준은 "같은 측정자가 잰 같은 종류 기기들의 중앙값"(peerReference)이 우선이다. 측정자마다 리그·보정이 달라
// Harman 타깃 하나와 비교하면 측정 차이까지 태그에 섞였다(Innerfidelity는 68%가 "고음 어두움", oratory1990은 29%).
// 같은 측정자 기기가 적으면(PEER_MIN 미만) Harman 타깃과 비교한다
import { features, type BandKey, type Values } from './similarity'
import type { DeviceCategory, Rig } from './types'

export interface SoundTag {
  /** 화면에 보이는 짧은 말. 예: "저음 강함" */
  label: string
  /** 기준보다 많음/적음/좁은 피크/기준에 가까움(색을 다르게 칠할 때 씀) */
  kind: 'more' | 'less' | 'peak' | 'neutral'
  /** 마우스를 올리면 보이는 근거. 예: "Harman 대비 저음(60~250Hz) +4.2dB" */
  detail: string
}

/** 대역마다 많을 때·적을 때 이름과 기준(dB). 3dB 정도부터 들어서 차이가 느껴진다 */
const RULES: { key: BandKey; range: string; more: string; less: string; threshold: number }[] = [
  { key: 'subBass', range: '20~60Hz', more: '초저음 많음', less: '초저음 부족', threshold: 4 },
  { key: 'bass', range: '60~250Hz', more: '저음 강함', less: '저음 약함', threshold: 3 },
  { key: 'lowMid', range: '250~800Hz', more: '중저음 두꺼움', less: '중저음 얇음', threshold: 2.5 },
  { key: 'presence', range: '2~5kHz', more: '중고음 쏨', less: '중고음 차분함', threshold: 3 },
  { key: 'treble', range: '5~10kHz', more: '고음 밝음', less: '고음 어두움', threshold: 3 },
]

/** 5~9kHz 사이 한 점이 기준보다 이만큼 높으면 "치찰음 피크"(대역 평균이 아니라 좁게 솟은 곳) */
const PEAK_DB = 6
/** 특별한 성향이 없고 기준과의 평균 차이(RMS)가 이보다 작으면 "타깃에 가까움" */
const NEUTRAL_RMS_DB = 2
const MAX_TAGS = 3

const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}dB`

/**
 * 성향 태그(차이가 큰 순서로 최대 3개).
 * values·reference: 같은 grid로 prepare한 값. referenceName: 근거 문구에 쓰는 기준 이름(예: "Harman")
 */
export function soundTags(
  values: Values,
  reference: Values,
  grid: number[],
  referenceName = '타깃',
  /** 두드러진 게 없을 때의 말. 타깃이면 "타깃에 가까움", 같은 측정자 평균이면 "평균적" */
  neutralLabel = '타깃에 가까움',
): SoundTag[] {
  const mine = features(values, grid)
  const ref = features(reference, grid)
  const found: (SoundTag & { size: number })[] = []

  for (const rule of RULES) {
    const a = mine[rule.key]
    const b = ref[rule.key]
    if (a === null || b === null) continue
    const diff = a - b
    if (Math.abs(diff) < rule.threshold) continue
    const name = diff > 0 ? rule.more : rule.less
    found.push({
      label: name,
      kind: diff > 0 ? 'more' : 'less',
      detail: `${referenceName} 대비 ${rule.range} ${signed(diff)}`,
      size: Math.abs(diff) / rule.threshold,
    })
  }

  // 좁은 피크: 5~9kHz에서 기준보다 가장 높이 솟은 점
  let peak: { diff: number; hz: number } | null = null
  for (let i = 0; i < grid.length; i++) {
    const v = values[i]
    const r = reference[i]
    if (grid[i] < 5000 || grid[i] > 9000 || v === null || r === null) continue
    if (!peak || v - r > peak.diff) peak = { diff: v - r, hz: grid[i] }
  }
  if (peak && peak.diff >= PEAK_DB) {
    found.push({
      label: '치찰음 피크',
      kind: 'peak',
      detail: `${referenceName} 대비 ${(peak.hz / 1000).toFixed(1)}kHz ${signed(peak.diff)}`,
      size: peak.diff / PEAK_DB,
    })
  }

  if (found.length === 0) {
    // 10kHz 위는 측정 편차가 커서 뺀다(추천 계산기와 같은 범위)
    const diffs = values.flatMap((v, i) => {
      const r = reference[i]
      return v === null || r === null || grid[i] > 10000 ? [] : [v - r]
    })
    const rms = diffs.length ? Math.sqrt(diffs.reduce((s, d) => s + d * d, 0) / diffs.length) : Infinity
    return rms < NEUTRAL_RMS_DB
      ? [{ label: neutralLabel, kind: 'neutral', detail: `${referenceName}와 평균 차이 ${rms.toFixed(1)}dB` }]
      : []
  }

  return found
    .sort((a, b) => b.size - a.size)
    .slice(0, MAX_TAGS)
    .map(({ size: _size, ...tag }) => tag)
}

/**
 * 비교 기준으로 쓸 타깃(targets.ts의 BUILTIN_TARGETS id).
 * 헤드폰은 Harman over-ear(5128로 잰 것은 5128용 LMG 타깃), 이어폰은 Harman in-ear.
 * 리그가 다르면 같은 소리도 곡선이 달라서 리그에 맞는 타깃을 고른다
 */
export function tagReferenceId(category: DeviceCategory, rig: Rig): string {
  if (category === 'iem') return 'autoeq:harman-ie-2019'
  return rig === '5128' ? 'autoeq:lmg-5128' : 'autoeq:harman-oe-2018'
}

/** 같은 측정자 기기가 이만큼은 있어야 그 중앙값을 기준으로 쓴다 */
export const PEER_MIN = 30

/** 여러 곡선(같은 grid로 다듬은 값)의 칸별 중앙값. 몇몇 튀는 기기에 덜 흔들리게 평균 대신 중앙값 */
export function medianValues(list: Values[]): Values {
  if (list.length === 0) return []
  return list[0].map((_, i) => {
    const column = list.map((v) => v[i]).filter((x): x is number => x !== null).sort((a, b) => a - b)
    if (column.length === 0) return null
    const mid = column.length >> 1
    return column.length % 2 ? column[mid] : (column[mid - 1] + column[mid]) / 2
  })
}
