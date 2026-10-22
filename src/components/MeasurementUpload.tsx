// CSV 파일을 골라 측정치로 저장하는 폼
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { parseFrCsv, type ParseResult } from '../csv'
import { channelLabels, rigLabels } from '../labels'
import { addMeasurement } from '../repo'
import type { Channel, Rig } from '../types'

interface Props {
  deviceId: string
  onDone: () => void
}

export function MeasurementUpload({ deviceId, onDone }: Props) {
  const [parsed, setParsed] = useState<ParseResult | null>(null)
  const [error, setError] = useState('')
  const [variant, setVariant] = useState('')
  const [rig, setRig] = useState<Rig>('711')
  const [channel, setChannel] = useState<Channel>('avg')
  const [source, setSource] = useState('local')

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setParsed(null)
    setError('')
    if (!file) return
    try {
      // file.text(): 파일 내용을 문자열로 읽는다. 시간이 걸리는 작업이라 await로 기다린다
      setParsed(parseFrCsv(await file.text()))
      // 구성 칸이 비어 있으면 파일 이름(확장자 제외)을 기본값으로 넣는다
      if (!variant) setVariant(file.name.replace(/\.[^.]+$/, ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!parsed) return
    await addMeasurement({
      deviceId,
      variant: variant.trim(),
      rig,
      channel,
      source: source.trim() || 'local',
      curve: parsed.curve,
    })
    onDone()
  }

  const first = parsed?.curve[0]
  const last = parsed?.curve[parsed.curve.length - 1]

  return (
    <form className="upload form" onSubmit={handleSubmit}>
      <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={handleFile} />

      {error && <p className="error">{error}</p>}
      {parsed && first && last && (
        <p className="muted small">
          {parsed.curve.length}포인트 · {first.freq}Hz ~ {last.freq}Hz
          {parsed.skippedLines > 0 && ` · 건너뛴 줄 ${parsed.skippedLines}개`}
        </p>
      )}

      <div className="row">
        <input placeholder="구성 (예: 기본 팁, 벨루어 패드)" value={variant} onChange={(e) => setVariant(e.target.value)} />
        <select value={rig} onChange={(e) => setRig(e.target.value as Rig)} title="측정 리그">
          {Object.entries(rigLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} title="채널">
          {Object.entries(channelLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input placeholder="출처" value={source} onChange={(e) => setSource(e.target.value)} title="출처 (직접 측정이면 local)" />
      </div>
      <button type="submit" disabled={!parsed}>
        저장
      </button>
    </form>
  )
}
