// 오른쪽 메인: 비교 탭 줄 + 그래프 툴바(정규화 기준, 타깃) + 리그 경고 + 범례 + FR 그래프
import type { CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { logGrid, normalizeAt, resample } from '../curve'
import { measurementLabel, rigLabels, sourceLabel } from '../labels'
import { getTarget, setNormalizeHz } from '../repo'
import { seriesColor } from '../selection'
import type { CompareTab, DeviceCategory } from '../types'
import { useCompareData, type SelectedItem } from '../useCompareData'
import { FrChart, type ChartSeries } from './FrChart'
import { TabBar } from './TabBar'
import { TargetSelect } from './TargetSelect'

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

  // 같은 기기가 여러 번 선택됐는지 센다(그러면 이름 뒤에 구성/출처를 붙여 구분)
  const deviceCount = new Map<string, number>()
  for (const { device } of selected) deviceCount.set(device.id, (deviceCount.get(device.id) ?? 0) + 1)
  const labelOf = ({ device, measurement }: SelectedItem) =>
    `${device.brand} ${device.model}` +
    ((deviceCount.get(device.id) ?? 0) > 1 ? ` (${measurementLabel(measurement)})` : '')

  // 곡선 8개 × 240칸 계산은 가벼워서 화면을 그릴 때마다 다시 계산해도 된다
  const series: ChartSeries[] = selected.map((item) => ({
    label: labelOf(item),
    colorIndex: item.selection.colorIndex,
    values: normalizeAt(resample(item.measurement.curve, GRID), item.measurement.curve, normalizeHz),
  }))
  if (target) {
    // 타깃도 같은 기준으로 정규화해야 기기 곡선과 겹쳐 비교할 수 있다
    series.push({
      label: `타깃: ${target.name}`,
      colorIndex: null,
      values: normalizeAt(resample(target.curve, GRID), target.curve, normalizeHz),
    })
  }

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
      </div>

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

      <FrChart grid={GRID} series={series} yTitle={yTitle} />
    </main>
  )
}
