// 그래프 아래 작은 범례: 색 점(또는 회색 점선 = 목표·타깃)과 이름. FrChart는 범례를 그리지 않아서 필요한 곳에 붙인다
import { seriesColor } from '../selection'

export interface LegendItem {
  label: string
  /** 팔레트 색 순번. null이면 목표·타깃(회색 점선) */
  colorIndex: number | null
}

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <p className="chart-legend small">
      {items.map((it) => (
        <span key={it.label}>
          <i className={it.colorIndex === null ? 'dashed' : undefined} style={it.colorIndex === null ? undefined : { background: seriesColor(it.colorIndex) }} />
          {it.label}
        </span>
      ))}
    </p>
  )
}
