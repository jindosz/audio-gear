// 카탈로그에 없는 기기를 직접 입력해 등록하는 폼 (기기 추가 팝업 안에서 사용)
import { useState, type FormEvent } from 'react'
import { categoryLabels } from '../labels'
import { addDevice } from '../repo'
import type { DeviceCategory } from '../types'
import { ToggleButton } from './ToggleButton'

interface Props {
  /** 등록이 끝나면 부를 함수(선택). 등록한 기기 이름을 넘겨준다 */
  onAdded?: (name: string) => void
}

export function DeviceForm({ onAdded }: Props) {
  // useState: 입력칸의 현재 값을 기억하는 상태. 값이 바뀌면 화면이 다시 그려진다
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [category, setCategory] = useState<DeviceCategory>('headphone')
  const [owned, setOwned] = useState(false)
  const [notes, setNotes] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault() // 폼 제출 시 페이지가 새로고침되는 브라우저 기본 동작을 막는다
    if (!brand.trim() || !model.trim()) return
    await addDevice({ brand: brand.trim(), model: model.trim(), category, owned, notes: notes.trim() })
    onAdded?.(`${brand.trim()} ${model.trim()}`)
    // 등록 후 이름 칸만 비우고 종류·보유 여부는 연속 등록하기 편하게 그대로 둔다
    setBrand('')
    setModel('')
    setNotes('')
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h2>직접 추가</h2>
      <div className="row">
        <input placeholder="브랜드" value={brand} onChange={(e) => setBrand(e.target.value)} required />
        <input placeholder="모델명" value={model} onChange={(e) => setModel(e.target.value)} required />
        <select value={category} onChange={(e) => setCategory(e.target.value as DeviceCategory)}>
          {Object.entries(categoryLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <ToggleButton on={owned} onChange={setOwned}>
          보유
        </ToggleButton>
      </div>
      <input placeholder="메모 (선택)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button type="submit">등록</button>
    </form>
  )
}
