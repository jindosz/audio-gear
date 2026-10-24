// 추천 팝업: 기준과 소리가 비슷한 기기를 찾아 보여준다.
// 기준 = 선택한 측정치 / 타깃 / 내 취향(비교 중인 기기 평균, 보유 기기 평균) + 저음·중고음·고음 조절
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
import { listDevices, listMeasurements, listSummaries, putTarget, setTabTarget, toggleSelection } from '../repo'
import { PALETTE_SIZE } from '../selection'
import { prepare, SUMMARY_GRID } from '../similarity'
import { startSummaryJob, stopSummaryJob, useSummaryJob } from '../summaryJob'
import { applyAdjustments, averageValues, NO_ADJUSTMENTS, toCurve, type Adjustments } from '../taste'
import type { Device, DeviceCategory, Measurement, Target } from '../types'
import { useCatalogDevices } from '../useCatalogDevices'
import type { SelectedItem } from '../useCompareData'
import { Modal } from './Modal'

interface Props {
  open: boolean
  onClose: () => void
  tabId: string
  selected: SelectedItem[]
  target: Target | undefined
  /** 왼쪽 메뉴에서 고른 카테고리. "보유 기기 평균"을 이 카테고리로 만든다 */
  category: DeviceCategory
}

export function RecommendDialog({ open, onClose, ...rest }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="비슷한 기기 찾기">
      <RecommendBody {...rest} />
    </Modal>
  )
}

/** 고를 수 있는 기준 하나(조절 전) */
interface BaseReference extends Reference {
  key: string
  label: string
}

/** 여러 측정치를 평균 낸 기준. 리그·측정자가 모두 같을 때만 그 값을 물려받는다 */
function averageReference(
  key: string,
  label: string,
  category: DeviceCategory,
  items: { device: Device; measurement: Measurement }[],
): BaseReference {
  const same = <T,>(list: T[]) => (list.every((x) => x === list[0]) ? list[0] : undefined)
  return {
    key,
    label: `${label} (${items.length}개)`,
    category,
    values: averageValues(items.map((i) => prepare(i.measurement.curve, SUMMARY_GRID))),
    rig: same(items.map((i) => i.measurement.rig)) ?? 'other',
    source: same(items.map((i) => i.measurement.source)),
    excludeNames: items.map((i) => `${i.device.brand} ${i.device.model}`),
  }
}

function RecommendBody({ tabId, selected, target, category: menuCategory }: Omit<Props, 'open' | 'onClose'>) {
  // 기준 키: 측정치 id / 'target' / 'avg:selected' / 'avg:owned'. 처음엔 첫 번째 선택(없으면 타깃)
  const [refKey, setRefKey] = useState(selected[0]?.measurement.id ?? (target ? 'target' : 'avg:owned'))
  const [adj, setAdj] = useState<Adjustments>(NO_ADJUSTMENTS)
  const [notice, setNotice] = useState('')
  const [savedTarget, setSavedTarget] = useState(false)
  // AutoEQ 후보를 비교에 넣으려고 측정치를 받는 중인 기기 이름
  const [pendingName, setPendingName] = useState<string | null>(null)

  const devices = useLiveQuery(listDevices)
  const measurements = useLiveQuery(listMeasurements)

  // ---- 고를 수 있는 기준 목록 ----
  const bases: BaseReference[] = selected.map((s) => ({
    key: s.measurement.id,
    label: `${s.device.brand} ${s.device.model} · ${sourceLabel(s.measurement.source)}`,
    category: s.device.category,
    values: prepare(s.measurement.curve, SUMMARY_GRID),
    rig: s.measurement.rig,
    source: s.measurement.source,
    excludeNames: [`${s.device.brand} ${s.device.model}`],
  }))
  if (target) {
    bases.push({
      key: 'target',
      label: `타깃: ${target.name}`,
      category: target.category,
      values: prepare(target.curve, SUMMARY_GRID),
      rig: target.rig,
    })
  }
  // 내 취향 1: 지금 비교 중인 기기들의 평균(첫 번째 기기와 같은 카테고리만)
  const sameCategory = selected.filter((s) => s.device.category === selected[0]?.device.category)
  if (sameCategory.length >= 2) {
    bases.push(
      averageReference('avg:selected', '내 취향: 비교 중인 기기 평균', sameCategory[0].device.category, sameCategory),
    )
  }
  // 내 취향 2: 보유 기기 평균(왼쪽 메뉴의 카테고리, 기기마다 첫 번째 측정치)
  const ownedItems = (devices ?? []).flatMap((device) => {
    if (!device.owned || device.category !== menuCategory) return []
    const measurement = measurements?.find((m) => m.deviceId === device.id)
    return measurement ? [{ device, measurement }] : []
  })
  if (ownedItems.length >= 1) {
    bases.push(averageReference('avg:owned', '내 취향: 보유 기기 평균', menuCategory, ownedItems))
  }

  const base = bases.find((b) => b.key === refKey) ?? bases[0]
  const isAdjusted = adj.bass !== 0 || adj.presence !== 0 || adj.treble !== 0
  // 조절값이 있으면 기준 곡선에 더한다(측정자·리그 정보는 그대로)
  const reference: Reference | undefined = base && {
    ...base,
    values: isAdjusted ? applyAdjustments(base.values, SUMMARY_GRID, adj) : base.values,
  }
  const category = reference?.category

  const summaries = useLiveQuery(() => (category ? listSummaries(category) : []), [category])

  if (!devices || !measurements || !summaries) return <p className="muted">불러오는 중…</p>
  if (!base || !reference || !category) {
    return <p className="muted">비교 중인 기기, 타깃, 또는 측정치가 있는 보유 기기가 있어야 기준으로 삼을 수 있습니다.</p>
  }

  const deviceById = new Map(devices.map((d) => [d.id, d]))
  const candidates = [
    ...measurements.flatMap((m) => {
      const device = deviceById.get(m.deviceId)
      return device ? [fromMeasurement(device, m)] : []
    }),
    ...summaries.map(fromSummary),
  ]
  // excludeNames 덕분에 기준 기기 자신은 후보에서 빠진다
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

  /** 지금 기준 곡선(조절 포함)을 내 타깃으로 저장하고 이 탭에 적용한다. 그래프에 회색 점선으로 보인다 */
  async function handleSaveTarget() {
    if (!base || !reference) return
    const signed = (v: number) => `${v > 0 ? '+' : ''}${v}`
    const parts = [
      adj.bass !== 0 && `저음 ${signed(adj.bass)}`,
      adj.presence !== 0 && `중고음 ${signed(adj.presence)}`,
      adj.treble !== 0 && `고음 ${signed(adj.treble)}`,
    ].filter(Boolean)
    const id = crypto.randomUUID()
    await putTarget({
      id,
      name: base.label.replace(/^타깃: /, '') + (parts.length ? ` (${parts.join(', ')})` : ''),
      category: reference.category,
      rig: reference.rig,
      isCustom: true,
      curve: toCurve(reference.values, SUMMARY_GRID),
    })
    await setTabTarget(tabId, id)
    setSavedTarget(true)
  }

  // 출처가 맞는 정도별로 묶어서 보여준다(같은 측정자 → 같은 리그 → 다른 출처)
  const levels: MatchLevel[] = [0, 1, 2]

  return (
    <div className="detail recommend">
      <div className="row">
        <label>
          기준{' '}
          <select value={base.key} onChange={(e) => setRefKey(e.target.value)}>
            {bases.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <TasteSliders
        adj={adj}
        onChange={(next) => {
          setAdj(next)
          setSavedTarget(false) // 조절을 바꾸면 "저장했습니다" 안내는 지운다
        }}
      />
      <div className="row">
        <button type="button" className="small" onClick={handleSaveTarget}>
          이 기준 곡선을 타깃으로 저장
        </button>
        {savedTarget && <span className="notice small">내 타깃으로 저장하고 이 탭에 적용했습니다(그래프의 회색 점선).</span>}
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

const SLIDERS: { key: keyof Adjustments; label: string; hint: string }[] = [
  { key: 'bass', label: '저음', hint: '약 150Hz 아래' },
  { key: 'presence', label: '중고음', hint: '3kHz 근처: 선명함·쏘는 느낌' },
  { key: 'treble', label: '고음', hint: '약 6kHz 위: 밝기·치찰음' },
]

/** 취향 조절 슬라이더: 기준 곡선의 대역을 올리고 내려 "이런 소리를 원한다"를 표현한다 */
function TasteSliders({ adj, onChange }: { adj: Adjustments; onChange: (adj: Adjustments) => void }) {
  const changed = adj.bass !== 0 || adj.presence !== 0 || adj.treble !== 0
  return (
    <div className="sliders">
      {SLIDERS.map((s) => (
        <label key={s.key} title={s.hint}>
          <span className="slider-name">{s.label}</span>
          {/* range: 끌어서 값을 고르는 입력칸. -6 ~ +6dB, 0.5dB 단위 */}
          <input
            type="range"
            min={-6}
            max={6}
            step={0.5}
            value={adj[s.key]}
            onChange={(e) => onChange({ ...adj, [s.key]: Number(e.target.value) })}
          />
          <span className="slider-value">
            {adj[s.key] > 0 ? '+' : ''}
            {adj[s.key]}dB
          </span>
        </label>
      ))}
      {changed ? (
        <button type="button" className="link small" onClick={() => onChange(NO_ADJUSTMENTS)}>
          조절 초기화
        </button>
      ) : (
        <span className="muted small">슬라이더로 기준보다 저음·중고음·고음을 더하거나 뺀 소리를 찾을 수 있습니다.</span>
      )}
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
  // 추천용 데이터는 AutoEQ 측정치만 받는다(squig.link는 수가 너무 많아 제외)
  const available = catalogDevices?.filter((d) => d.category === category && d.primary?.provider === 'autoeq').length
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
