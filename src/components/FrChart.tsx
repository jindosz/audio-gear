// FR 곡선 그래프. Chart.js는 React용 라이브러리가 아니라서,
// <canvas> 요소를 useRef로 잡고 useEffect 안에서 직접 차트를 만들고 갱신한다.
import { useEffect, useRef } from 'react'
import {
  Chart,
  LinearScale,
  LineController,
  LineElement,
  LogarithmicScale,
  PointElement,
  Tooltip,
  type ChartDataset,
} from 'chart.js'
import { useResolvedTheme } from '../theme'

// Chart.js는 필요한 부품만 등록해서 쓴다(안 쓰는 기능은 번들에서 빠져 앱이 가벼워짐)
Chart.register(LineController, LineElement, PointElement, LinearScale, LogarithmicScale, Tooltip)

export interface ChartSeries {
  label: string
  /** 팔레트 색 순번. null이면 타깃 곡선(회색 점선) */
  colorIndex: number | null
  /** grid와 같은 길이의 dB 값. 값이 없는 칸은 null */
  values: (number | null)[]
}

interface Props {
  grid: number[]
  series: ChartSeries[]
  /** y축 제목. 예: "dB (1kHz = 0)" */
  yTitle: string
  /** 차이 그래프면 true: 툴팁 값에 +/- 부호를 붙인다 */
  signed?: boolean
  /** 바깥 상자에 더할 CSS 클래스 */
  className?: string
}

// 그래프 점 하나: x = 주파수(Hz), y = dB (값이 없으면 null)
type XY = { x: number; y: number | null }

const X_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]

function formatHz(hz: number): string {
  return hz >= 1000 ? `${+(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)}k` : `${Math.round(hz)}`
}

/** CSS 변수의 실제 색 값을 읽는다. canvas는 var(--series-0) 같은 CSS 문법을 모른다 */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

export function FrChart({ grid, series, yTitle, signed = false, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart<'line', XY[]> | null>(null)
  // 테마(시스템 설정 또는 설정 팝업에서 고른 값)가 바뀌면 그래프 색을 다시 읽도록 쓴다
  const scheme = useResolvedTheme()

  // 차트는 처음에 한 번 만들고, 화면이 사라질 때 없앤다
  useEffect(() => {
    const chart = new Chart<'line', XY[]>(canvasRef.current!, {
      type: 'line',
      data: { datasets: [] },
      options: {
        animation: false,
        maintainAspectRatio: false, // 부모 요소 크기에 맞춰 늘어난다
        parsing: false,
        spanGaps: false,
        // 마우스를 올린 x 위치에서 모든 곡선의 값을 툴팁에 보여준다(모든 곡선이 같은 grid라 가능)
        interaction: { mode: 'index', intersect: false },
        elements: {
          line: { borderWidth: 2, tension: 0 },
          point: { radius: 0, hoverRadius: 4, hitRadius: 6 },
        },
        scales: {
          x: {
            type: 'logarithmic',
            min: 20,
            max: 20000,
            // 로그 축의 기본 눈금 대신 보기 좋은 값만 표시
            afterBuildTicks: (axis) => {
              axis.ticks = X_TICKS.map((value) => ({ value }))
            },
            ticks: { callback: (value) => formatHz(Number(value)), autoSkip: false, maxRotation: 0 },
          },
          y: { title: { display: true } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => `${formatHz(items[0].parsed.x ?? 0)}Hz`,
            },
          },
        },
      },
    })
    chartRef.current = chart
    return () => chart.destroy()
  }, [])

  // 데이터·색·테마가 바뀔 때마다 차트 내용을 갱신한다
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const text = cssVar('--muted')
    const gridLine = cssVar('--border')

    chart.data.datasets = series.map(
      (s): ChartDataset<'line', XY[]> => ({
        label: s.label,
        data: grid.map((x, i) => ({ x, y: s.values[i] })),
        borderColor: s.colorIndex === null ? text : cssVar(`--series-${s.colorIndex}`),
        backgroundColor: s.colorIndex === null ? text : cssVar(`--series-${s.colorIndex}`),
        // 타깃은 점선([선 길이, 빈칸 길이])으로 그리고, 기기 곡선보다 뒤(order가 클수록 뒤)에 둔다
        borderDash: s.colorIndex === null ? [6, 4] : [],
        order: s.colorIndex === null ? 1 : 0,
      }),
    )

    const { x, y } = chart.options.scales!
    for (const axis of [x!, y!]) {
      axis.grid = { color: gridLine }
      axis.border = { color: gridLine }
      axis.ticks = { ...axis.ticks, color: text }
    }
    y!.title = { display: true, text: yTitle, color: text }
    chart.options.plugins!.tooltip!.callbacks!.label = (item) => {
      const v = item.parsed.y ?? 0
      return ` ${item.dataset.label}: ${signed && v > 0 ? '+' : ''}${v.toFixed(1)} dB`
    }
    chart.update()
  }, [grid, series, yTitle, signed, scheme])

  return (
    <div className={className ? `chart-box ${className}` : 'chart-box'}>
      <canvas ref={canvasRef} role="img" aria-label="주파수 응답 그래프" />
    </div>
  )
}
