// 추천 팝업: 기준(선택한 측정치 또는 타깃)과 소리가 비슷한 기기를 찾아 보여준다.
// 지금 후보는 내 DB에 저장된 측정치. (AutoEQ 전체를 후보로 쓰는 "추천용 데이터 받기"는 다음 단계)
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { categoryLabels, rigLabels, sourceLabel } from '../labels'
import { matchLabels, recommend, similarityLabel, type MatchLevel, type Reference } from '../recommend'
import { listDevices, listMeasurements, toggleSelection } from '../repo'
import { PALETTE_SIZE } from '../selection'
import type { Target } from '../types'
import type { SelectedItem } from '../useCompareData'
import { Modal } from './Modal'

interface Props {
  open: boolean
  onClose: () => void
  tabId: string
  selected: SelectedItem[]
  target: Target | undefined
}

export function RecommendDialog({ open, onClose, ...rest }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="비슷한 기기 찾기">
      <RecommendBody {...rest} />
    </Modal>
  )
}

function RecommendBody({ tabId, selected, target }: Omit<Props, 'open' | 'onClose'>) {
  const devices = useLiveQuery(listDevices)
  const measurements = useLiveQuery(listMeasurements)
  // 기준: 측정치 id 또는 'target'. 처음엔 첫 번째 선택(없으면 타깃)
  const [refKey, setRefKey] = useState(selected[0]?.measurement.id ?? (target ? 'target' : ''))
  const [notice, setNotice] = useState('')

  const refItem = selected.find((s) => s.measurement.id === refKey)
  const reference: Reference | null = refItem
    ? {
        curve: refItem.measurement.curve,
        category: refItem.device.category,
        rig: refItem.measurement.rig,
        source: refItem.measurement.source,
        deviceId: refItem.device.id,
      }
    : refKey === 'target' && target
      ? { curve: target.curve, category: target.category, rig: target.rig }
      : null

  if (!devices || !measurements) return <p className="muted">불러오는 중…</p>
  if (!reference) return <p className="muted">비교 중인 기기나 타깃이 있어야 기준으로 삼을 수 있습니다.</p>

  const deviceById = new Map(devices.map((d) => [d.id, d]))
  const candidates = measurements.flatMap((m) => {
    const device = deviceById.get(m.deviceId)
    return device ? [{ device, measurement: m }] : []
  })
  const results = recommend(reference, candidates)
  const selectedIds = new Set(selected.map((s) => s.measurement.id))

  async function handleAdd(measurementId: string) {
    setNotice('')
    if ((await toggleSelection(tabId, measurementId)) === 'full') {
      setNotice(`최대 ${PALETTE_SIZE}개까지 비교할 수 있습니다. 하나를 해제한 뒤 추가하세요.`)
    }
  }

  // 출처가 맞는 정도별로 묶어서 보여준다(같은 측정자 → 같은 리그 → 다른 출처)
  const levels: MatchLevel[] = [0, 1, 2]

  return (
    <div className="detail recommend">
      <div className="row">
        <label>
          기준{' '}
          <select value={refKey} onChange={(e) => setRefKey(e.target.value)}>
            {selected.map((s) => (
              <option key={s.measurement.id} value={s.measurement.id}>
                {s.device.brand} {s.device.model} · {sourceLabel(s.measurement.source)}
              </option>
            ))}
            {target && <option value="target">타깃: {target.name}</option>}
          </select>
        </label>
      </div>
      <p className="muted small">
        {categoryLabels[reference.category]} 중에서 기준과 소리 모양(주파수 응답)이 가까운 순서입니다. 측정자·리그가
        다르면 같은 기기도 곡선이 달라지므로, 같은 측정자 → 같은 리그 후보를 먼저 보여줍니다. 지금 후보는 내 기기 목록에
        저장된 측정치 {candidates.length}개입니다.
      </p>
      {notice && <p className="error small">{notice}</p>}
      {results.length === 0 && (
        <p className="muted">비교할 후보가 없습니다. 같은 종류의 기기를 목록에서 더 받아 두세요.</p>
      )}

      {levels.map((level) => {
        const group = results.filter((r) => r.level === level)
        if (group.length === 0) return null
        return (
          <section key={level}>
            <h3>
              {matchLabels[level]}
              {level === 0 && reference.source && <span className="muted small"> · {sourceLabel(reference.source)}</span>}
              {level === 1 && <span className="muted small"> · {rigLabels[reference.rig]}</span>}
            </h3>
            <ul className="rec-list">
              {group.map((r) => (
                <li key={r.measurement.id}>
                  <div className="rec-main">
                    <strong>
                      {r.device.brand} {r.device.model}
                    </strong>
                    <span className="muted small">
                      {' '}
                      · {sourceLabel(r.measurement.source)} · {rigLabels[r.measurement.rig]}
                    </span>
                    <div className="small">
                      <span className="rec-score">
                        {similarityLabel(r.distance)} ({r.distance.toFixed(1)}dB)
                      </span>
                      {r.reasons.length > 0 && <span className="muted"> · 기준보다 {r.reasons.join(', ')}</span>}
                    </div>
                  </div>
                  {selectedIds.has(r.measurement.id) ? (
                    <span className="muted small">비교 중</span>
                  ) : (
                    <button type="button" className="small" onClick={() => handleAdd(r.measurement.id)}>
                      비교에 추가
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
