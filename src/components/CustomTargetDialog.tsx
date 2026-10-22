// 커스텀 타깃 불러오기 팝업: CSV 파일 + 이름·카테고리·리그를 받아 내 타깃으로 저장한다.
// 타깃은 측정치와 같은 "주파수,dB" 형식이라 측정치 업로드와 같은 파서(parseFrCsv)를 쓴다.
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { parseFrCsv, type ParseResult } from '../csv'
import { categoryLabels, rigLabels } from '../labels'
import { putTarget } from '../repo'
import type { DeviceCategory, Rig } from '../types'
import { Modal } from './Modal'

interface Props {
  open: boolean
  /** 처음 고를 카테고리(지금 왼쪽 메뉴에서 고른 것) */
  category: DeviceCategory
  onClose: () => void
  /** 저장이 끝나면 새 타깃 id를 넘겨준다 */
  onSaved: (targetId: string) => void
}

export function CustomTargetDialog({ open, category, onClose, onSaved }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="타깃 CSV 불러오기">
      <CustomTargetForm initialCategory={category} onSaved={onSaved} />
    </Modal>
  )
}

function CustomTargetForm({
  initialCategory,
  onSaved,
}: {
  initialCategory: DeviceCategory
  onSaved: (targetId: string) => void
}) {
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState<DeviceCategory>(initialCategory)
  const [rig, setRig] = useState<Rig>(initialCategory === 'iem' ? '711' : 'gras')

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setParsed(null)
    setError('')
    if (!file) return
    try {
      setParsed(parseFrCsv(await file.text()))
      // 이름 칸이 비어 있으면 파일 이름(확장자 제외)을 기본값으로 넣는다
      if (!name) setName(file.name.replace(/\.[^.]+$/, ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!parsed || !name.trim()) return
    const id = crypto.randomUUID()
    await putTarget({ id, name: name.trim(), category, rig, isCustom: true, curve: parsed.curve })
    onSaved(id)
  }

  const first = parsed?.curve[0]
  const last = parsed?.curve[parsed.curve.length - 1]

  return (
    <form className="form detail" onSubmit={handleSubmit}>
      <p className="muted small">
        한 줄에 "주파수, dB" 형식의 CSV/텍스트 파일. 측정치 업로드와 같은 형식이고, AutoEQ·squig.link에서 받은 타깃
        파일도 쓸 수 있습니다.
      </p>
      <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={handleFile} data-autofocus />

      {error && <p className="error">{error}</p>}
      {parsed && first && last && (
        <p className="muted small">
          {parsed.curve.length}포인트 · {first.freq}Hz ~ {last.freq}Hz
          {parsed.skippedLines > 0 && ` · 건너뛴 줄 ${parsed.skippedLines}개`}
        </p>
      )}

      <div className="row">
        <input placeholder="타깃 이름" value={name} onChange={(e) => setName(e.target.value)} required />
        <select value={category} onChange={(e) => setCategory(e.target.value as DeviceCategory)} title="카테고리">
          {Object.entries(categoryLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}용
            </option>
          ))}
        </select>
        <select value={rig} onChange={(e) => setRig(e.target.value as Rig)} title="이 타깃이 기준으로 삼는 측정 리그">
          {Object.entries(rigLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <p className="muted small">리그는 리그 불일치 경고에 쓰입니다. 모르면 "기타"를 고르세요.</p>
      <button type="submit" disabled={!parsed || !name.trim()}>
        저장하고 이 탭에 적용
      </button>
    </form>
  )
}
