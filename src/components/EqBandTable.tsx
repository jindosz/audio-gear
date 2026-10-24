// EQ 밴드(피크 필터) 표: 주파수·게인·Q를 직접 고치고, 밴드를 더하고 뺀다
import { useState } from 'react'
import type { PeakFilter } from '../eq'

interface Props {
  filters: PeakFilter[]
  onChange: (filters: PeakFilter[]) => void
}

const LIMITS = {
  freq: { min: 20, max: 20000 },
  gain: { min: -15, max: 15 },
  q: { min: 0.1, max: 10 },
}
const MAX_BANDS = 20

export function EqBandTable({ filters, onChange }: Props) {
  const set = (i: number, patch: Partial<PeakFilter>) => onChange(filters.map((f, j) => (j === i ? { ...f, ...patch } : f)))

  function handleAdd() {
    // 새 밴드는 1kHz, 0dB에서 시작. 표는 주파수 순서로 정리해 둔다
    onChange([...filters, { freq: 1000, gain: 0, q: 1 }].sort((a, b) => a.freq - b.freq))
  }

  return (
    <div className="eq-bands">
      {filters.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>주파수 (Hz)</th>
              <th>게인 (dB)</th>
              <th title="폭. 클수록 좁은 범위만 바뀝니다">Q</th>
              <th aria-label="삭제" />
            </tr>
          </thead>
          <tbody>
            {filters.map((f, i) => (
              // 밴드에는 따로 id가 없어 순번을 key로 쓴다(값을 고쳐도 줄 순서는 그대로라 괜찮음)
              <tr key={i}>
                <td className="muted">{i + 1}</td>
                <td>
                  <NumberInput label={`${i + 1}번 주파수`} value={f.freq} step={1} digits={0} {...LIMITS.freq} onChange={(freq) => set(i, { freq })} />
                </td>
                <td className="gain-cell">
                  {/* 슬라이더로 대략, 숫자 칸으로 정확히 */}
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={0.1}
                    value={f.gain}
                    onChange={(e) => set(i, { gain: Number(e.target.value) })}
                    aria-label={`${i + 1}번 게인`}
                  />
                  <NumberInput label={`${i + 1}번 게인`} value={f.gain} step={0.1} digits={1} {...LIMITS.gain} onChange={(gain) => set(i, { gain })} />
                </td>
                <td>
                  <NumberInput label={`${i + 1}번 Q`} value={f.q} step={0.05} digits={2} {...LIMITS.q} onChange={(q) => set(i, { q })} />
                </td>
                <td>
                  <button type="button" className="icon-btn small" onClick={() => onChange(filters.filter((_, j) => j !== i))} title="밴드 삭제" aria-label={`${i + 1}번 밴드 삭제`}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="row">
        <button type="button" onClick={handleAdd} disabled={filters.length >= MAX_BANDS}>
          + 밴드 추가
        </button>
        {filters.length > 0 && (
          <button type="button" onClick={() => confirm('밴드를 모두 지울까요?') && onChange([])}>
            모두 지우기
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * 숫자 칸. 입력하는 동안은 글자 그대로 두고(예: "1." 같은 중간 상태), 칸을 벗어나거나 Enter를 누르면
 * 범위 안의 숫자로 맞춰 반영한다
 */
function NumberInput({
  label,
  value,
  min,
  max,
  step,
  digits,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  digits: number
  onChange: (v: number) => void
}) {
  // 입력 중인 글자. null이면 입력 중이 아니라서 value를 그대로 보여준다
  const [draft, setDraft] = useState<string | null>(null)

  function commit() {
    if (draft === null) return
    const n = Number(draft)
    if (draft.trim() !== '' && Number.isFinite(n)) {
      const factor = 10 ** digits
      onChange(Math.round(Math.min(max, Math.max(min, n)) * factor) / factor)
    }
    setDraft(null)
  }

  return (
    <input
      type="number"
      className="num-input"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={draft ?? String(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  )
}
