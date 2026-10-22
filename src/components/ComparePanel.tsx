// 오른쪽 메인: 비교 탭 줄 + 그래프 툴바(정규화 기준) + 범례 + FR 그래프
import type { CSSProperties } from 'react'
import { logGrid, normalizeAt, resample } from '../curve'
import { measurementLabel, sourceLabel } from '../labels'
import { setNormalizeHz } from '../repo'
import { seriesColor } from '../selection'
import type { CompareTab } from '../types'
import { useCompareData, type SelectedItem } from '../useCompareData'
import { FrChart, type ChartSeries } from './FrChart'
import { TabBar } from './TabBar'

// 모든 곡선을 같은 주파수 위치로 맞춰 그린다(한 번만 계산)
const GRID = logGrid()
const NORMALIZE_OPTIONS = [200, 500, 1000, 2000]

interface Props {
  tabs: CompareTab[]
  activeId: string | undefined
  onSelectTab: (id: string) => void
}

export function ComparePanel({ tabs, activeId, onSelectTab }: Props) {
  const { selected, tab } = useCompareData(activeId)
  const normalizeHz = tab?.normalizeHz ?? null

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
      </div>

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
      </ul>

      <FrChart grid={GRID} series={series} yTitle={yTitle} />
    </main>
  )
}
