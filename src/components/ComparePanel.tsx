// 오른쪽 메인: 그래프 툴바(정규화 기준) + 범례 + FR 그래프
import { useMemo, type CSSProperties } from 'react'
import { logGrid, normalizeAt, resample } from '../curve'
import { setNormalizeHz } from '../repo'
import { seriesColor } from '../selection'
import { useCompareData } from '../useCompareData'
import { FrChart, type ChartSeries } from './FrChart'

// 모든 곡선을 같은 주파수 위치로 맞춰 그린다(한 번만 계산)
const GRID = logGrid()
const NORMALIZE_OPTIONS = [200, 500, 1000, 2000]

export function ComparePanel() {
  const { selected, tab } = useCompareData()
  const normalizeHz = tab?.normalizeHz ?? null

  // useMemo: 선택이나 정규화 기준이 바뀔 때만 다시 계산한다(곡선 계산은 비교적 무거움)
  const series = useMemo<ChartSeries[]>(
    () =>
      selected.map(({ selection, device, measurement }) => ({
        label: `${device.brand} ${device.model}`,
        colorIndex: selection.colorIndex,
        values: normalizeAt(resample(measurement.curve, GRID), measurement.curve, normalizeHz),
      })),
    [selected, normalizeHz],
  )

  if (selected.length === 0 || !tab) {
    return (
      <main className="main-col empty">
        <p className="muted">목록에서 기기를 클릭하면 여기에서 비교합니다.</p>
      </main>
    )
  }

  const yTitle = normalizeHz ? `dB (${normalizeHz >= 1000 ? `${normalizeHz / 1000}k` : normalizeHz}Hz = 0)` : 'dB'

  return (
    <main className="main-col">
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
        {selected.map(({ selection, device, measurement }) => (
          <li key={selection.measurementId} style={{ '--c': seriesColor(selection.colorIndex) } as CSSProperties}>
            <span className="swatch" aria-hidden="true" />
            {device.brand} {device.model}
            <span className="muted small"> · {measurement.source === 'local' ? '직접 업로드' : measurement.source}</span>
          </li>
        ))}
      </ul>

      <FrChart grid={GRID} series={series} yTitle={yTitle} />
    </main>
  )
}
