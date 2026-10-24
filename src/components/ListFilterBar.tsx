// 기기 목록 필터 칸: 브랜드 선택, 유선/무선, 오픈/밀폐(헤드폰만), ANC
import { EMPTY_FILTER, activeCount, type ListFilter } from '../listFilter'
import type { DeviceCategory } from '../types'
import { ToggleButton } from './ToggleButton'

interface Props {
  category: DeviceCategory
  filter: ListFilter
  onChange: (f: ListFilter) => void
  brands: { key: string; label: string; count: number }[]
}

/** 세그먼트 버튼 한 묶음. value가 null이면 "전체" */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | null
  options: { value: T; label: string }[]
  onChange: (v: T | null) => void
}) {
  const all = [{ value: null, label: '전체' }, ...options]
  return (
    <div className="segmented small" role="group" aria-label={label}>
      {all.map((o) => (
        <button
          key={o.label}
          type="button"
          className={value === o.value ? 'active' : undefined}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ListFilterBar({ category, filter, onChange, brands }: Props) {
  const set = (patch: Partial<ListFilter>) => onChange({ ...filter, ...patch })
  const specOn = filter.connection || filter.acoustic || filter.anc

  return (
    <div className="list-filter">
      <select
        value={filter.brand ?? ''}
        onChange={(e) => set({ brand: e.target.value || null })}
        aria-label="브랜드"
      >
        <option value="">모든 브랜드</option>
        {brands.map((b) => (
          <option key={b.key} value={b.key}>
            {b.label} ({b.count})
          </option>
        ))}
      </select>
      <div className="row">
        <Segmented
          label="연결 방식"
          value={filter.connection}
          options={[
            { value: 'wired', label: '유선' },
            { value: 'wireless', label: '무선' },
          ]}
          onChange={(connection) => set({ connection })}
        />
        <ToggleButton small on={filter.anc} onChange={(anc) => set({ anc })}>
          ANC
        </ToggleButton>
      </div>
      {/* 이어폰은 거의 모두 밀폐형이라 헤드폰에서만 보여준다 */}
      {category === 'headphone' && (
        <Segmented
          label="구조"
          value={filter.acoustic}
          options={[
            { value: 'open', label: '오픈형' },
            { value: 'closed', label: '밀폐형' },
          ]}
          onChange={(acoustic) => set({ acoustic })}
        />
      )}
      {specOn && <p className="muted small">특징은 입력값 또는 이름으로 추정한 값 기준이라, 정보가 없는 기기는 빠집니다.</p>}
      {activeCount(filter) > 0 && (
        <button type="button" className="filter-reset" onClick={() => onChange(EMPTY_FILTER)}>
          필터 초기화
        </button>
      )}
    </div>
  )
}
