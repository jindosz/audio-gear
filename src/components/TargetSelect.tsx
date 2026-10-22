// 그래프 툴바의 타깃 선택 드롭다운. 지금 카테고리(헤드폰/이어폰)에 맞는 타깃을 위에 둔다
import { useState } from 'react'
import { categoryLabels, rigLabels } from '../labels'
import { setTabTarget } from '../repo'
import { BUILTIN_TARGETS, ensureTarget } from '../targets'
import type { DeviceCategory } from '../types'

interface Props {
  tabId: string
  targetId: string | null
  category: DeviceCategory
}

export function TargetSelect({ tabId, targetId, category }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleChange(id: string) {
    setError('')
    if (!id) return setTabTarget(tabId, null)
    setLoading(true)
    try {
      await ensureTarget(id) // 처음 고르는 타깃이면 이때 받아서 저장한다
      await setTabTarget(tabId, id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  // 지금 카테고리 타깃을 먼저, 다른 카테고리 타깃은 아래 묶음으로
  const groups = [category, category === 'headphone' ? 'iem' : 'headphone'] as const

  return (
    <label>
      타깃{' '}
      <select value={targetId ?? ''} onChange={(e) => handleChange(e.target.value)} disabled={loading}>
        <option value="">없음</option>
        {groups.map((c) => (
          // optgroup: 선택지를 제목 아래로 묶어 보여준다
          <optgroup key={c} label={`${categoryLabels[c]}용`}>
            {BUILTIN_TARGETS.filter((t) => t.category === c).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({rigLabels[t.rig]})
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {loading && <span className="muted small"> 받는 중…</span>}
      {error && <span className="error small"> {error}</span>}
    </label>
  )
}
