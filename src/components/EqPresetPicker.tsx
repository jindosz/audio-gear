// 저장한 EQ 고르기: 검색 + 즐겨찾기 → 지금 쓰는 기기별 묶음(최근 수정 순). 폰에 적용 중인 EQ 표시.
// PC는 EQ 화면 왼쪽 칸에, 폰은 "EQ 고르기" 시트(팝업) 안에 같은 부품을 쓴다
import { useState } from 'react'
import { useAppliedEq, useEqStatus } from '../eqEngine'
import { groupPresets } from '../eqPresetList'
import { setEqPresetFavorite } from '../repo'
import type { EqPreset } from '../types'
import { PlusIcon, StarIcon } from './Icons'

interface Props {
  presets: EqPreset[]
  /** 측정치 id → 지금 쓰는 기기 이름(묶음 제목·검색에 쓴다) */
  deviceNameOf: (measurementId: string) => string
  activeId: string | undefined
  onSelect: (id: string) => void
  onNew: () => void
  newDisabled: boolean
}

export function EqPresetPicker({ presets, deviceNameOf, activeId, onSelect, onNew, newDisabled }: Props) {
  const [query, setQuery] = useState('')
  const applied = useAppliedEq(useEqStatus())
  const groups = groupPresets(presets, deviceNameOf, query)

  return (
    <div className="eq-picker">
      <div className="eq-picker-top">
        <input type="search" placeholder="EQ 검색" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="EQ 검색" />
        <button type="button" className="primary" onClick={onNew} disabled={newDisabled}>
          <PlusIcon size={16} /> 새 EQ
        </button>
      </div>

      {presets.length === 0 && <p className="muted small">아직 EQ가 없습니다.</p>}
      {presets.length > 0 && groups.length === 0 && <p className="muted small">결과 없음</p>}

      {groups.map((group) => (
        <section key={group.key} className="eq-group">
          <h3 className="eq-group-title">{group.title}</h3>
          <ul>
            {group.items.map((p) => (
              <li key={p.id} className="eq-row">
                <button
                  type="button"
                  className={p.id === activeId ? 'eq-item active' : 'eq-item'}
                  aria-pressed={p.id === activeId}
                  onClick={() => onSelect(p.id)}
                >
                  <span className="eq-item-name">{p.name}</span>
                  <span className="muted small">
                    밴드 {p.filters.length}개{applied?.id === p.id && <strong className="eq-applied"> · 폰 적용 중</strong>}
                  </span>
                </button>
                <button
                  type="button"
                  className={p.favorite ? 'star-btn on' : 'star-btn'}
                  onClick={() => setEqPresetFavorite(p.id, !p.favorite)}
                  aria-pressed={!!p.favorite}
                  title={p.favorite ? '즐겨찾기 해제' : '즐겨찾기'}
                  aria-label={p.favorite ? `${p.name} 즐겨찾기 해제` : `${p.name} 즐겨찾기`}
                >
                  <StarIcon filled={!!p.favorite} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
