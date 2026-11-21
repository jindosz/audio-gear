// 파일 고르기: 브라우저 기본 "파일 선택" 상자(회색 네모 + 영어 문구) 대신 앱 모양 버튼 + 고른 파일 이름.
// 진짜 <input type="file">은 보이지 않게 두고(키보드로는 그대로 고를 수 있게 visually-hidden), label을 누르면 열린다
import { useState, type ChangeEvent } from 'react'
import { FileIcon } from './Icons'

interface Props {
  accept: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  /** 버튼 글자 */
  label?: string
}

export function FilePicker({ accept, onChange, label = '파일 고르기' }: Props) {
  const [name, setName] = useState('')
  return (
    <label className="file-picker">
      <input
        type="file"
        className="visually-hidden"
        accept={accept}
        onChange={(e) => {
          setName(e.target.files?.[0]?.name ?? '')
          onChange(e)
        }}
      />
      <span className="file-picker-button">
        <FileIcon size={16} /> {label}
      </span>
      <span className={name ? 'file-picker-name' : 'file-picker-name muted'}>{name || '고른 파일 없음'}</span>
    </label>
  )
}
