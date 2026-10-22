// 타깃 커브: "이런 모양이면 듣기 좋다"는 기준 곡선(Harman 등).
// AutoEQ 저장소의 targets 폴더에 측정치와 같은 CSV 형식으로 있어서, 고를 때 받아 DB에 저장한다.
import { parseFrCsv } from './csv'
import { getTarget, putTarget } from './repo'
import type { DeviceCategory, Rig, Target } from './types'

const TARGETS_BASE = 'https://raw.githubusercontent.com/jaakkopasanen/AutoEq/master/targets'

interface BuiltinTarget {
  id: string
  name: string
  /** targets 폴더의 파일 이름(.csv 제외) */
  file: string
  category: DeviceCategory
  /** 이 타깃이 기준으로 삼는 측정 리그. 측정치 리그와 다르면 경고한다 */
  rig: Rig
}

// 앱에서 고를 수 있는 기본 타깃. 리그는 각 타깃이 만들어진 측정 환경 기준
// (Harman 헤드폰 타깃은 GRAS, Harman 이어폰 타깃은 IEC 711 커플러, 5128 타깃은 B&K 5128)
export const BUILTIN_TARGETS: BuiltinTarget[] = [
  { id: 'autoeq:harman-oe-2018', name: 'Harman over-ear 2018', file: 'Harman over-ear 2018', category: 'headphone', rig: 'gras' },
  { id: 'autoeq:oratory-oe', name: 'oratory1990 optimum hifi over-ear', file: 'oratory1990 optimum hifi over-ear', category: 'headphone', rig: 'gras' },
  { id: 'autoeq:df-kemar', name: 'Diffuse field (GRAS KEMAR)', file: 'Diffuse field GRAS KEMAR', category: 'headphone', rig: 'gras' },
  { id: 'autoeq:df-5128', name: 'Diffuse field (B&K 5128)', file: 'Diffuse field 5128', category: 'headphone', rig: '5128' },
  { id: 'autoeq:lmg-5128', name: 'LMG 5128 0.6', file: 'LMG 5128 0.6', category: 'headphone', rig: '5128' },
  { id: 'autoeq:harman-ie-2019', name: 'Harman in-ear 2019', file: 'Harman in-ear 2019', category: 'iem', rig: '711' },
  { id: 'autoeq:autoeq-ie', name: 'AutoEq in-ear', file: 'AutoEq in-ear', category: 'iem', rig: '711' },
  { id: 'autoeq:oratory-ie', name: 'oratory1990 in-ear', file: 'oratory1990 in-ear', category: 'iem', rig: '711' },
]

/** 타깃을 DB에서 꺼낸다. 없으면 AutoEQ에서 받아 저장한 뒤 돌려준다 */
export async function ensureTarget(id: string): Promise<Target> {
  const saved = await getTarget(id)
  if (saved) return saved
  const builtin = BUILTIN_TARGETS.find((t) => t.id === id)
  if (!builtin) throw new Error('알 수 없는 타깃입니다.')

  const res = await fetch(`${TARGETS_BASE}/${encodeURIComponent(`${builtin.file}.csv`)}`)
  if (!res.ok) throw new Error(`타깃을 받지 못했습니다 (${res.status})`)
  const target: Target = {
    id: builtin.id,
    name: builtin.name,
    category: builtin.category,
    rig: builtin.rig,
    isCustom: false,
    curve: parseFrCsv(await res.text()).curve,
  }
  await putTarget(target)
  return target
}
