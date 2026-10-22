// 그래프 툴바의 타깃 선택 드롭다운.
// 순서: 없음 → 내 타깃(CSV로 불러온 것) → 지금 카테고리 기본 타깃 → 다른 카테고리 기본 타깃 → CSV 불러오기…
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { categoryLabels, rigLabels } from '../labels'
import { deleteTarget, listCustomTargets, setTabTarget } from '../repo'
import { BUILTIN_TARGETS, ensureTarget } from '../targets'
import type { DeviceCategory } from '../types'
import { CustomTargetDialog } from './CustomTargetDialog'

interface Props {
  tabId: string
  targetId: string | null
  category: DeviceCategory
}

/** 드롭다운에서 "CSV 불러오기…"를 나타내는 특별한 값(실제 타깃 id와 겹치지 않게) */
const UPLOAD = '__upload__'

export function TargetSelect({ tabId, targetId, category }: Props) {
  const customTargets = useLiveQuery(listCustomTargets)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)

  async function handleChange(id: string) {
    setError('')
    if (id === UPLOAD) return setUploadOpen(true) // 선택값은 바뀌지 않고 팝업만 연다
    if (!id) return setTabTarget(tabId, null)
    setLoading(true)
    try {
      await ensureTarget(id) // 처음 고르는 기본 타깃이면 이때 받아서 저장한다
      await setTabTarget(tabId, id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleSaved(newId: string) {
    setUploadOpen(false)
    await setTabTarget(tabId, newId)
  }

  const current = customTargets?.find((t) => t.id === targetId)

  async function handleDelete() {
    if (!current || !confirm(`내 타깃 "${current.name}"을 삭제할까요? 이 타깃을 쓰는 모든 탭에서 빠집니다.`)) return
    await deleteTarget(current.id)
  }

  // 지금 카테고리 타깃을 먼저, 다른 카테고리 타깃은 아래 묶음으로
  const groups = [category, category === 'headphone' ? 'iem' : 'headphone'] as const

  return (
    // 팝업은 <label> 바깥에 둔다. label 안에 있으면 팝업 안을 클릭할 때 드롭다운이 대신 눌린다
    <>
      <label>
        타깃{' '}
        <select value={targetId ?? ''} onChange={(e) => handleChange(e.target.value)} disabled={loading}>
          <option value="">없음</option>
          {customTargets && customTargets.length > 0 && (
            // optgroup: 선택지를 제목 아래로 묶어 보여준다
            <optgroup label="내 타깃">
              {customTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({categoryLabels[t.category]}, {rigLabels[t.rig]})
                </option>
              ))}
            </optgroup>
          )}
          {groups.map((c) => (
            <optgroup key={c} label={`${categoryLabels[c]}용`}>
              {BUILTIN_TARGETS.filter((t) => t.category === c).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({rigLabels[t.rig]})
                </option>
              ))}
            </optgroup>
          ))}
          <option value={UPLOAD}>+ CSV 불러오기…</option>
        </select>
        {current && (
          <button type="button" className="link danger small" onClick={handleDelete} title="이 내 타깃 삭제">
            삭제
          </button>
        )}
        {loading && <span className="muted small"> 받는 중…</span>}
        {error && <span className="error small"> {error}</span>}
      </label>
      <CustomTargetDialog
        open={uploadOpen}
        category={category}
        onClose={() => setUploadOpen(false)}
        onSaved={handleSaved}
      />
    </>
  )
}
