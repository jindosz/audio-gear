// "EQ로 들어보기" 팝업: 지금 쓰는 기기에 걸면 들어볼 기기와 비슷한 소리가 나는 EQ를 만들어
// 기기 전체 EQ 앱(Equalizer APO, Wavelet 등)에 넣을 수 있게 복사·저장한다.
// 웹앱은 스트리밍 앱의 소리를 직접 바꿀 수 없어서, EQ 앱에서 켜고 끄며 미리 듣는 방식이다.
// 만든 EQ는 EQ 목록(EQ 화면)에 저장해 두고 나중에 다시 고치거나 내보낼 수 있다.
import { lazy, Suspense, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { fitPeq, MAX_BOOST, targetEq } from '../eq'
import { applyPreset, getEqEngine } from '../eqEngine'
import { categoryLabels, sourceLabel } from '../labels'
import { addEqPreset, listDevices, listMeasurements } from '../repo'
import { FINE_GRID } from '../similarity'
import type { DeviceCategory, FrCurve, Target } from '../types'
import type { SelectedItem } from '../useCompareData'
import { EqExport } from './EqExport'
import { Help } from './Help'
import { Modal } from './Modal'
import { AlertIcon } from './Icons'

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
  // 안드로이드 앱: [폰에 적용] 결과 한 줄
  const [phoneMessage, setPhoneMessage] = useState('')

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
      <p className="muted">보유 기기(기기 상세 → 보유)와 들어볼 기기(비교 중인 기기 또는 타깃)가 필요해요.</p>
    )
  }

  const eq = fitPeq(targetEq(current.curve, wish.curve))
  const sameSource = !!current.source && current.source === wish.source
  const pair = `${current.key}|${wish.key}`

  /** EQ 목록에 저장하고 저장된 id와 이름을 돌려준다(이미 저장했으면 그대로). 실패하면 null */
  async function handleSave(): Promise<{ id: string; name: string } | null> {
    if (!current || !wish) return null
    if (saved?.pair === pair) return saved
    setSaveError('')
    // EQ 화면의 자동 계산과 같은 이름 규칙("기기 → 목표")
    const name = `${current.name} → ${wish.name}`
    try {
      const id = await addEqPreset({ name, measurementId: current.key, goal: wish.goal, filters: eq.filters })
      setSaved({ pair, id, name })
      return { id, name }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
      return null
    }
  }

  /** 안드로이드 앱: 저장(아직이면)한 뒤 그 EQ를 폰 전체에 건다 */
  async function handleApplyToPhone() {
    setPhoneMessage('적용 중…')
    const preset = await handleSave()
    if (!preset) return setPhoneMessage('')
    try {
      const result = await applyPreset(preset.id, preset.name, eq)
      setPhoneMessage(result.on ? `폰에 적용했습니다: ${preset.name}` : `적용하지 못했습니다${result.error ? `: ${result.error}` : ''}`)
    } catch (err) {
      setPhoneMessage(`적용하지 못했습니다: ${err instanceof Error ? err.message : String(err)}`)
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
        <p className="warning small" title="헤드폰과 이어폰은 측정 방식이 달라 EQ 결과가 부정확합니다">
          <AlertIcon size={15} /> {categoryLabels[current.category]}↔{categoryLabels[wish.category]}: 결과가 부정확할 수 있어요
        </p>
      )}
      {wish.key !== 'target' && !sameSource && (
        <p
          className="warning small"
          title={`${sourceLabel(current.source ?? '')} / ${sourceLabel(wish.source ?? '')} — 측정 환경 차이까지 EQ에 섞이므로 같은 측정자를 고르는 것이 좋습니다`}
        >
          <AlertIcon size={15} /> 측정자가 달라요
        </p>
      )}

      <p className="small muted">
        필터 {eq.filters.length}개 · 프리앰프 {eq.preamp.toFixed(1)}dB · 오차 {eq.error.toFixed(1)}dB
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

      {/* 할 일 버튼을 먼저: 폰에 적용(안드로이드 앱) · EQ 목록에 저장 */}
      <div className="row">
        {getEqEngine().kind === 'android' && (
          <button type="button" className="primary" onClick={handleApplyToPhone} disabled={eq.filters.length === 0}>
            폰에 적용
          </button>
        )}
        {saved?.pair === pair ? (
          <button type="button" onClick={() => onOpenPreset(saved.id)}>
            EQ 화면에서 열기
          </button>
        ) : (
          <button type="button" onClick={() => void handleSave()} disabled={eq.filters.length === 0}>
            EQ 목록에 저장
          </button>
        )}
      </div>
      {(phoneMessage || saved?.pair === pair || saveError) && (
        <p className="small" role="status">
          {saveError ? <span className="error">저장하지 못했어요: {saveError}</span> : phoneMessage || `저장했어요: ${saved?.name}`}
        </p>
      )}

      <EqExport eq={eq} name={`${current.name} → ${wish.name}`} />

      <Help>
        <p>지금 쓰는 기기에 EQ를 걸어 들어볼 기기와 비슷한 음색으로 만듭니다. 부스트는 최대 +{MAX_BOOST}dB, 측정 편차가 큰 8kHz 위는 덜 따라갑니다.</p>
        <p>EQ로 바뀌는 것은 음색(주파수 응답)뿐이라 공간감·해상도·착용감은 따라 할 수 없어요.</p>
        <p>"EQ 목록에 저장"하면 EQ 화면에서 밴드를 직접 고칠 수 있습니다.</p>
      </Help>
    </div>
  )
}
