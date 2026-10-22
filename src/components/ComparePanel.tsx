// 오른쪽 메인: 지금은 선택한 기기와 색만 보여준다(다음 단계에서 그래프로 바뀜)
import type { CSSProperties } from 'react'
import { seriesColor } from '../selection'
import { useCompareData } from '../useCompareData'

export function ComparePanel() {
  const { selected } = useCompareData()

  if (selected.length === 0) {
    return (
      <main className="main-col empty">
        <p className="muted">목록에서 기기를 클릭하면 여기에서 비교합니다.</p>
      </main>
    )
  }

  return (
    <main className="main-col">
      <ul className="legend">
        {selected.map(({ selection, device, measurement }) => (
          <li key={selection.measurementId} style={{ '--c': seriesColor(selection.colorIndex) } as CSSProperties}>
            <span className="swatch" aria-hidden="true" />
            {device.brand} {device.model}
            <span className="muted small"> · {measurement.source === 'local' ? '직접 업로드' : measurement.source}</span>
          </li>
        ))}
      </ul>
      <p className="muted placeholder">그래프는 다음 단계에서 이 자리에 그려집니다.</p>
    </main>
  )
}
