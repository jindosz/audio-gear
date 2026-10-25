// "EQ로 들어보기" 팝업: 지금 쓰는 기기에 걸면 들어볼 기기와 비슷한 소리가 나는 EQ를 만들어
// 기기 전체 EQ 앱(Equalizer APO, Wavelet 등)에 넣을 수 있게 복사·저장한다.
// 웹앱은 스트리밍 앱의 소리를 직접 바꿀 수 없어서, EQ 앱에서 켜고 끄며 미리 듣는 방식이다.
// 만든 EQ는 EQ 목록(EQ 화면)에 저장해 두고 나중에 다시 고치거나 내보낼 수 있다.
import { lazy, Suspense, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { fitPeq, MAX_BOOST, targetEq } from '../eq'
import { categoryLabels, sourceLabel } from '../labels'
import { addEqPreset, listDevices, listMeasurements } from '../repo'
import { FINE_GRID } from '../similarity'
import type { DeviceCategory, FrCurve, Target } from '../types'
import type { SelectedItem } from '../useCompareData'
import { EqExport } from './EqExport'
import { Modal } from './Modal'

const FrChart = lazy(() => import('./FrChart').then((m) => ({ default: m.FrChart })))

interface Props {
  open: boolean
  onClose: () => void
  selected: SelectedItem[]
  target: Target | undefined
  category: DeviceCategory
  /** 저장한 EQ를 EQ 화면에서 열기 */
  onOpenPreset: (id: string) => void
}

export function EqDialog({ open, onClose, ...rest }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="EQ로 들어보기">
      <EqBody {...rest} />
    </Modal>
  )
}

/** 고를 수 있는 곡선 하나(기기 측정치 또는 타깃) */
interface CurveOption {
  key: string
  label: string
  /** EQ 이름에 쓸 짧은 이름(기기 이름 또는 타깃 이름) */
  name: string
  /** EQ 목록에 저장할 때의 목표 값('m:측정치 id' 또는 't:타깃 id') */
  goal: string
  curve: FrCurve
  category: DeviceCategory
  /** 측정자(source). 타깃이면 없음 */
  source?: string
}

function EqBody({ selected, target, category, onOpenPreset }: Omit<Props, 'open' | 'onClose'>) {
  const devices = useLiveQuery(listDevices)
  const measurements = useLiveQuery(listMeasurements)
  const [currentKey, setCurrentKey] = useState('')
  const [wishKey, setWishKey] = useState('')
  // 방금 저장한 EQ. pair(지금 기기|들어볼 소리)가 바뀌면 안내를 감춘다
  const [saved, setSaved] = useState<{ pair: string; id: string; name: string } | null>(null)
  const [saveError, setSaveError] = useState('')

  if (!devices || !measurements) return <p className="muted">불러오는 중…</p>

  // 지금 쓰는 기기 후보: 보유 기기의 측정치(먼저) + 비교 중인 측정치
  const deviceById = new Map(devices.map((d) => [d.id, d]))
  const option = (m: (typeof measurements)[number]): CurveOption | null => {
    const d = deviceById.get(m.deviceId)
    if (!d) return null
    const name = `${d.brand} ${d.model}`
    return { key: m.id, label: `${name} · ${sourceLabel(m.source)}`, name, goal: `m:${m.id}`, curve: m.curve, category: d.category, source: m.source }
  }
  const ownedOptions = measurements
    .filter((m) => deviceById.get(m.deviceId)?.owned)
    .map(option)
    .filter((o): o is CurveOption => o !== null)
  const selectedOptions = selected.map((s) => option(s.measurement)).filter((o): o is CurveOption => o !== null)
  const currentOptions = [...ownedOptions, ...selectedOptions.filter((o) => !ownedOptions.some((x) => x.key === o.key))]
  // 들어볼 소리 후보: 비교 중인 측정치 + 타깃
  const wishOptions: CurveOption[] = [
    ...selectedOptions,
    ...(target
      ? [{ key: 'target', label: `타깃: ${target.name}`, name: target.name, goal: `t:${target.id}`, curve: target.curve, category: target.category }]
      : []),
  ]

  // 기본값: 지금 기기 = 지금 카테고리의 첫 보유 기기, 들어볼 소리 = 지금 기기가 아닌 첫 번째
  const current =
    currentOptions.find((o) => o.key === currentKey) ??
    currentOptions.find((o) => o.category === category) ??
    currentOptions[0]
  const wish = wishOptions.find((o) => o.key === wishKey) ?? wishOptions.find((o) => o.key !== current?.key)

  if (!current || !wish) {
    return (
      <p className="muted">
        EQ를 만들려면 지금 쓰는 기기(보유 기기의 측정치)와 들어볼 기기(비교 중인 기기 또는 타깃)가 필요합니다. 목록에서
        보유 기기를 표시하고, 들어볼 기기를 비교에 추가해 주세요.
      </p>
    )
  }

  const eq = fitPeq(targetEq(current.curve, wish.curve))
  const sameSource = !!current.source && current.source === wish.source
  const pair = `${current.key}|${wish.key}`

  async function handleSave() {
    if (!current || !wish) return
    setSaveError('')
    // EQ 화면의 자동 계산과 같은 이름 규칙("기기 → 목표")
    const name = `${current.name} → ${wish.name}`
    try {
      const id = await addEqPreset({ name, measurementId: current.key, goal: wish.goal, filters: eq.filters })
      setSaved({ pair, id, name })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="detail eq">
      <div className="row">
        <label>
          지금 쓰는 기기{' '}
          <select value={current.key} onChange={(e) => setCurrentKey(e.target.value)}>
            {currentOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <span aria-hidden="true">→</span>
        <label>
          들어볼 소리{' '}
          <select value={wish.key} onChange={(e) => setWishKey(e.target.value)}>
            {wishOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {current.category !== wish.category && (
        <p className="warning small">
          ⚠ {categoryLabels[current.category]}과 {categoryLabels[wish.category]}은 측정 방식이 달라 EQ 결과가 부정확합니다.
        </p>
      )}
      {wish.key !== 'target' && !sameSource && (
        <p className="warning small">
          ⚠ 두 측정치의 측정자가 다릅니다({sourceLabel(current.source ?? '')} / {sourceLabel(wish.source ?? '')}). 측정 환경
          차이까지 EQ에 섞이므로, 가능하면 같은 측정자 측정치를 고르세요.
        </p>
      )}

      <p className="small">
        필터 {eq.filters.length}개 · 프리앰프 {eq.preamp.toFixed(1)}dB · 목표와의 오차 {eq.error.toFixed(1)}dB
        <span className="muted">
          {' '}
          (부스트는 최대 +{MAX_BOOST}dB, 측정 편차가 큰 8kHz 위는 덜 따라갑니다)
        </span>
      </p>

      <div className="eq-chart">
        <Suspense fallback={<p className="muted">그래프 불러오는 중…</p>}>
          <FrChart
            grid={FINE_GRID}
            series={[
              { label: '목표 EQ', colorIndex: null, values: eq.target },
              { label: '만든 EQ', colorIndex: 0, values: eq.response },
            ]}
            yTitle="EQ (dB)"
            signed
          />
        </Suspense>
      </div>

      <EqExport eq={eq} name={wish.label} />

      <div className="row">
        {saved?.pair === pair ? (
          <>
            <span className="small" role="status">
              EQ 목록에 저장했습니다: {saved.name}
            </span>
            <button type="button" onClick={() => onOpenPreset(saved.id)}>
              EQ 화면에서 열기
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={handleSave} disabled={eq.filters.length === 0}>
              EQ 목록에 저장
            </button>
            <span className="muted small">저장하면 EQ 화면에서 밴드를 직접 고치거나 나중에 다시 내보낼 수 있습니다.</span>
          </>
        )}
        {saveError && <span className="error small">저장하지 못했습니다: {saveError}</span>}
      </div>
      <p className="muted small">
        EQ로 바뀌는 것은 주파수 응답(음색)뿐입니다. 공간감, 해상도, 착용감 같은 차이는 따라 할 수 없어서 "비슷한
        음색"까지만 들어볼 수 있습니다.
      </p>
    </div>
  )
}
