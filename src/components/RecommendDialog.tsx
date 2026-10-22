// 추천 팝업: 기준(선택한 측정치 또는 타깃)과 소리가 비슷한 기기를 찾아 보여준다.
// 후보 = 내 DB의 측정치 + "추천용 데이터 받기"로 저장한 AutoEQ 요약값
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addFromCatalog } from '../catalog'
import { categoryLabels, rigLabels, sourceLabel, specTags } from '../labels'
import {
  fromMeasurement,
  fromSummary,
  matchLabels,
  recommend,
  similarityLabel,
  type MatchLevel,
  type Recommendation,
  type Reference,
} from '../recommend'
import { listDevices, listMeasurements, listSummaries, toggleSelection } from '../repo'
import { PALETTE_SIZE } from '../selection'
import { startSummaryJob, stopSummaryJob, useSummaryJob } from '../summaryJob'
import type { DeviceCategory, Target } from '../types'
import { useCatalogDevices } from '../useCatalogDevices'
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
  // 기준: 측정치 id 또는 'target'. 처음엔 첫 번째 선택(없으면 타깃)
  const [refKey, setRefKey] = useState(selected[0]?.measurement.id ?? (target ? 'target' : ''))
  const [notice, setNotice] = useState('')
  // AutoEQ 후보를 비교에 넣으려고 측정치를 받는 중인 기기 이름
  const [pendingName, setPendingName] = useState<string | null>(null)

  const refItem = selected.find((s) => s.measurement.id === refKey)
  const reference: Reference | null = refItem
    ? {
        curve: refItem.measurement.curve,
        category: refItem.device.category,
        rig: refItem.measurement.rig,
        source: refItem.measurement.source,
        name: `${refItem.device.brand} ${refItem.device.model}`,
      }
    : refKey === 'target' && target
      ? { curve: target.curve, category: target.category, rig: target.rig }
      : null
  const category = reference?.category

  const devices = useLiveQuery(listDevices)
  const measurements = useLiveQuery(listMeasurements)
  const summaries = useLiveQuery(() => (category ? listSummaries(category) : []), [category])

  if (!devices || !measurements || !summaries) return <p className="muted">불러오는 중…</p>
  if (!reference || !category) return <p className="muted">비교 중인 기기나 타깃이 있어야 기준으로 삼을 수 있습니다.</p>

  const deviceById = new Map(devices.map((d) => [d.id, d]))
  const candidates = [
    ...measurements.flatMap((m) => {
      const device = deviceById.get(m.deviceId)
      return device ? [fromMeasurement(device, m)] : []
    }),
    ...summaries.map(fromSummary),
  ]
  const results = recommend(reference, candidates)
  const selectedIds = new Set(selected.map((s) => s.measurement.id))

  async function handleAdd(r: Recommendation) {
    setNotice('')
    if (selected.length >= PALETTE_SIZE) {
      setNotice(`최대 ${PALETTE_SIZE}개까지 비교할 수 있습니다. 하나를 해제한 뒤 추가하세요.`)
      return
    }
    let measurementId = r.candidate.measurement?.id
    if (!measurementId && r.candidate.catalog) {
      // AutoEQ 후보: 이때 전체 측정치를 받아 내 기기로 저장한다
      setPendingName(r.candidate.name)
      try {
        measurementId = (await addFromCatalog(r.candidate.catalog, false)).measurementId
      } catch (err) {
        setNotice(`${r.candidate.name}: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setPendingName(null)
      }
    }
    if (measurementId) await toggleSelection(tabId, measurementId)
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

      <CatalogDataBox category={category} saved={summaries.length} />

      <p className="muted small">
        {categoryLabels[category]} 중에서 기준과 소리 모양(주파수 응답)이 가까운 순서입니다. 측정자·리그가 다르면 같은
        기기도 곡선이 달라지므로, 같은 측정자 → 같은 리그 후보를 먼저 보여줍니다. (묶음마다 가까운 15개)
      </p>
      {notice && <p className="error small">{notice}</p>}
      {results.length === 0 && <p className="muted">비교할 후보가 없습니다. 위에서 추천용 데이터를 받아 보세요.</p>}

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
                <RecommendRow
                  key={r.candidate.name}
                  r={r}
                  inCompare={!!r.candidate.measurement && selectedIds.has(r.candidate.measurement.id)}
                  pending={pendingName === r.candidate.name}
                  onAdd={() => handleAdd(r)}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function RecommendRow({
  r,
  inCompare,
  pending,
  onAdd,
}: {
  r: Recommendation
  inCompare: boolean
  pending: boolean
  onAdd: () => void
}) {
  const { candidate } = r
  const tags = candidate.device ? specTags(candidate.device) : []
  return (
    <li>
      <div className="rec-main">
        <strong>{candidate.name}</strong>
        <span className="muted small">
          {' '}
          · {sourceLabel(candidate.source)} · {rigLabels[candidate.rig]}
        </span>
        {/* 내 기기 목록에 없는 AutoEQ 후보 표시 */}
        {!candidate.device && <span className="tag">새 기기</span>}
        {tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
        <div className="small">
          <span className="rec-score">
            {similarityLabel(r.distance)} ({r.distance.toFixed(1)}dB)
          </span>
          {r.reasons.length > 0 && <span className="muted"> · 기준보다 {r.reasons.join(', ')}</span>}
        </div>
      </div>
      {inCompare ? (
        <span className="muted small">비교 중</span>
      ) : (
        <button type="button" className="small" onClick={onAdd} disabled={pending}>
          {pending ? '받는 중…' : '비교에 추가'}
        </button>
      )}
    </li>
  )
}

/** 추천용 데이터 받기 상자: 몇 개 받았는지, 받기 시작/이어 받기/멈추기 */
function CatalogDataBox({ category, saved }: { category: DeviceCategory; saved: number }) {
  const job = useSummaryJob()
  const { catalogDevices } = useCatalogDevices()
  // 이 카테고리에서 측정치가 공개된 AutoEQ 기기 수 = 받을 수 있는 최대 개수
  const available = catalogDevices?.filter((d) => d.category === category && d.primary).length
  const running = job.status === 'running' || job.status === 'stopping'
  const thisJob = job.category === category
  const total = available ?? (thisJob ? job.total : 0)
  const percent = total ? Math.min(100, Math.round((saved / total) * 100)) : 0

  let message: string
  if (running && !thisJob) message = '다른 카테고리를 받는 중입니다. 끝난 뒤 받을 수 있습니다.'
  else if (running) message = `받는 중… ${percent}%${job.failed ? ` (실패 ${job.failed}개)` : ''}. 팝업을 닫아도 계속 받습니다.`
  else if (thisJob && job.status === 'error') message = `오류: ${job.error}`
  else if (saved === 0)
    message = `받으면 AutoEQ ${categoryLabels[category]} 전체가 추천 후보가 됩니다. 기기마다 측정치를 하나씩 받아 요약값(곡선당 숫자 약 60개)만 저장합니다. 처음 한 번 수십 MB를 받고 몇 분 걸립니다.`
  else if (thisJob && job.failed) message = `받지 못한 ${job.failed}개는 "이어 받기"로 다시 시도할 수 있습니다.`
  else message = '받아 둔 데이터는 다음에도 그대로 쓰입니다. 중간에 멈춰도 이어서 받을 수 있습니다.'

  return (
    <div className="data-box">
      <div className="row">
        <span className="small">
          AutoEQ 추천용 데이터({categoryLabels[category]}): <strong>{saved.toLocaleString()}</strong>
          {total > 0 && ` / ${total.toLocaleString()}개`}
        </span>
        {running && thisJob ? (
          <button type="button" className="small" onClick={stopSummaryJob} disabled={job.status === 'stopping'}>
            {job.status === 'stopping' ? '멈추는 중…' : '멈추기'}
          </button>
        ) : (
          (total === 0 || saved < total) && (
            <button type="button" className="small primary" onClick={() => startSummaryJob(category)} disabled={running}>
              {saved > 0 ? '이어 받기' : '받기 시작'}
            </button>
          )
        )}
      </div>
      {total > 0 && <progress max={100} value={percent} />}
      <p className="muted small">{message}</p>
    </div>
  )
}
