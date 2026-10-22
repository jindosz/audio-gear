// 오른쪽 메인: 비교 탭 줄 + 그래프 툴바(정규화 기준, 타깃, 차이 기준) + 리그 경고 + 범례 + FR 그래프 + 차이 그래프
import { lazy, Suspense, useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { diffValues, logGrid, normalizeAt, resample } from '../curve'
import { measurementLabel, rigLabels, sourceLabel } from '../labels'
import { getTarget, setDiffRef, setNormalizeHz } from '../repo'
import { seriesColor } from '../selection'
import type { CompareTab, DeviceCategory } from '../types'
import { useCompareData, type SelectedItem } from '../useCompareData'
import type { ChartSeries } from './FrChart'
import { EqDialog } from './EqDialog'
import { RecommendDialog } from './RecommendDialog'
import { TabBar } from './TabBar'
import { TargetSelect } from './TargetSelect'

// 그래프(Chart.js, 앱 코드의 절반 가까운 크기)는 필요할 때 따로 불러온다(lazy).
// 첫 화면에 필요한 파일이 작아져서 앱이 더 빨리 뜨고, 빌드 파일도 둘로 나뉜다
const FrChart = lazy(() => import('./FrChart').then((m) => ({ default: m.FrChart })))

// 모든 곡선을 같은 주파수 위치로 맞춰 그린다(한 번만 계산)
const GRID = logGrid()
const NORMALIZE_OPTIONS = [200, 500, 1000, 2000]

interface Props {
  tabs: CompareTab[]
  activeId: string | undefined
  onSelectTab: (id: string) => void
  /** 왼쪽 메뉴에서 고른 카테고리. 타깃 목록 순서에 쓴다 */
  category: DeviceCategory
}

export function ComparePanel({ tabs, activeId, onSelectTab, category }: Props) {
  const { selected, tab } = useCompareData(activeId)
  const normalizeHz = tab?.normalizeHz ?? null
  const targetId = tab?.targetId ?? null
  const target = useLiveQuery(() => (targetId ? getTarget(targetId) : undefined), [targetId])
  const [recommendOpen, setRecommendOpen] = useState(false)
  const [eqOpen, setEqOpen] = useState(false)

  // 같은 기기가 여러 번 선택됐는지 센다(그러면 이름 뒤에 구성/출처를 붙여 구분)
  const deviceCount = new Map<string, number>()
  for (const { device } of selected) deviceCount.set(device.id, (deviceCount.get(device.id) ?? 0) + 1)
  const labelOf = ({ device, measurement }: SelectedItem) =>
    `${device.brand} ${device.model}` +
    ((deviceCount.get(device.id) ?? 0) > 1 ? ` (${measurementLabel(measurement)})` : '')

  // 곡선 8개 × 240칸 계산은 가벼워서 화면을 그릴 때마다 다시 계산해도 된다.
  // key: 차이 기준을 고를 때 쓰는 이름표(측정치 id, 타깃은 'target')
  const curves: (ChartSeries & { key: string })[] = selected.map((item) => ({
    key: item.measurement.id,
    label: labelOf(item),
    colorIndex: item.selection.colorIndex,
    values: normalizeAt(resample(item.measurement.curve, GRID), item.measurement.curve, normalizeHz),
  }))
  if (target) {
    // 타깃도 같은 기준으로 정규화해야 기기 곡선과 겹쳐 비교할 수 있다
    curves.push({
      key: 'target',
      label: `타깃: ${target.name}`,
      colorIndex: null,
      values: normalizeAt(resample(target.curve, GRID), target.curve, normalizeHz),
    })
  }
  const series: ChartSeries[] = curves

  // 차이 곡선: 기준 곡선을 나머지 곡선에서 뺀다. 기준이 사라졌으면(선택 해제·타깃 끔) 끈 것으로 본다
  const reference = curves.find((c) => c.key === tab?.diffRef)
  const diffSeries: ChartSeries[] = reference
    ? curves
        .filter((c) => c !== reference)
        .map((c) => ({ label: c.label, colorIndex: c.colorIndex, values: diffValues(c.values, reference.values) }))
    : []

  // 리그 불일치: 리그를 아는 측정치 중 타깃과 리그가 다른 것. '기타'(모름)는 따로 안내만 한다
  const mismatched = target ? selected.filter((s) => s.measurement.rig !== 'other' && s.measurement.rig !== target.rig) : []
  const unknownRig = target ? selected.filter((s) => s.measurement.rig === 'other') : []

  const tabBar = <TabBar tabs={tabs} activeId={activeId} onSelect={onSelectTab} />

  if (selected.length === 0 || !tab) {
    return (
      <main className="main-col">
        {tabBar}
        <p className="muted placeholder">목록에서 기기를 클릭하면 여기에서 비교합니다.</p>
      </main>
    )
  }

  const yTitle = normalizeHz ? `dB (${normalizeHz >= 1000 ? `${normalizeHz / 1000}k` : normalizeHz}Hz = 0)` : 'dB'

  return (
    <main className="main-col">
      {tabBar}
      <div className="toolbar">
        <label>
          정규화 기준{' '}
          <select
            value={normalizeHz ?? ''}
            onChange={(e) => setNormalizeHz(tab.id, e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">끔</option>
            {NORMALIZE_OPTIONS.map((hz) => (
              <option key={hz} value={hz}>
                {hz >= 1000 ? `${hz / 1000}kHz` : `${hz}Hz`}
              </option>
            ))}
          </select>
        </label>
        <TargetSelect tabId={tab.id} targetId={targetId} category={category} />
        <label>
          차이 기준{' '}
          <select value={reference?.key ?? ''} onChange={(e) => setDiffRef(tab.id, e.target.value || null)}>
            <option value="">끔</option>
            {curves.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => setRecommendOpen(true)}>
          비슷한 기기 찾기
        </button>
        <button type="button" onClick={() => setEqOpen(true)}>
          EQ로 들어보기
        </button>
      </div>
      <RecommendDialog
        open={recommendOpen}
        onClose={() => setRecommendOpen(false)}
        tabId={tab.id}
        selected={selected}
        target={target}
        category={category}
      />
      <EqDialog open={eqOpen} onClose={() => setEqOpen(false)} selected={selected} target={target} category={category} />

      {target && mismatched.length > 0 && (
        <p className="warning small" role="status">
          ⚠ 리그 불일치: 타깃은 {rigLabels[target.rig]} 기준인데{' '}
          {mismatched.map((s) => `${labelOf(s)}(${rigLabels[s.measurement.rig]})`).join(', ')}는 다른 리그로 측정됐습니다.
          리그가 다르면 같은 소리도 곡선이 달라서 타깃과의 차이를 그대로 믿기 어렵습니다.
        </p>
      )}
      {target && unknownRig.length > 0 && (
        <p className="muted small">리그 정보가 없는 측정치 {unknownRig.length}개는 타깃과 리그가 같은지 알 수 없습니다.</p>
      )}

      <ul className="legend">
        {selected.map((item) => (
          <li key={item.selection.measurementId} style={{ '--c': seriesColor(item.selection.colorIndex) } as CSSProperties}>
            <span className="swatch" aria-hidden="true" />
            {labelOf(item)}
            {/* 이름에 이미 출처가 붙어 있으면 다시 쓰지 않는다 */}
            {!labelOf(item).includes(sourceLabel(item.measurement.source)) && (
              <span className="muted small"> · {sourceLabel(item.measurement.source)}</span>
            )}
          </li>
        ))}
        {target && (
          <li>
            <span className="swatch target" aria-hidden="true" />
            타깃: {target.name}
          </li>
        )}
      </ul>

      {/* Suspense: lazy로 불러오는 동안 fallback을 대신 보여준다 */}
      <Suspense fallback={<p className="muted placeholder">그래프 불러오는 중…</p>}>
        <FrChart grid={GRID} series={series} yTitle={yTitle} />
        {reference && diffSeries.length > 0 && (
          <FrChart
            className="diff"
            grid={GRID}
            series={diffSeries}
            yTitle={`차이 dB (기준: ${reference.label})`}
            signed
          />
        )}
        {reference && diffSeries.length === 0 && (
          <p className="muted small">차이를 볼 곡선이 없습니다. 기기를 하나 더 선택하세요.</p>
        )}
      </Suspense>
    </main>
  )
}
