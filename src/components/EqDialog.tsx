// "EQ로 들어보기" 팝업: 지금 쓰는 기기에 걸면 들어볼 기기와 비슷한 소리가 나는 EQ를 만들어
// 기기 전체 EQ 앱(Equalizer APO, Wavelet 등)에 넣을 수 있게 복사·저장한다.
// 웹앱은 스트리밍 앱의 소리를 직접 바꿀 수 없어서, EQ 앱에서 켜고 끄며 미리 듣는 방식이다.
// 만든 EQ는 EQ 목록(EQ 화면)에 저장해 두고 나중에 다시 고치거나 내보낼 수 있다.
import { lazy, Suspense, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { EXACT_SMOOTHING, fitPeq, matchError, MAX_BOOST, targetEq } from '../eq'
import { isAndroidApp } from '../platform'
import { addCatalogMeasurement, catalogCurvesFor, catalogSourceLabel } from '../catalog'
import { pickCommonSource } from '../sameMeasurer'
import { showToast } from '../toast'
import { applyPreset, getEqEngine } from '../eqEngine'
import { categoryLabels, sourceLabel } from '../labels'
import { addEqPreset, listDevices, listEqPresets, listMeasurements } from '../repo'
import { findSamePreset } from '../eqPresetList'
import { FINE_GRID } from '../similarity'
import type { DeviceCategory, FrCurve, Target } from '../types'
import type { SelectedItem } from '../useCompareData'
import { EqExport } from './EqExport'
import { Select } from './Select'
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
  // 저장한(또는 이미 있던) EQ. existing: 같은 조합이 이미 있어서 새로 만들지 않음
  const [saved, setSaved] = useState<{ pair: string; id: string; name: string; existing?: boolean } | null>(null)
  const [saveError, setSaveError] = useState('')
  // 안드로이드 앱: [폰에 적용] 결과 한 줄
  const [phoneMessage, setPhoneMessage] = useState('')
  const [matching, setMatching] = useState(false)

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
  // 비교 중인 측정치 + 그 기기의 다른 저장된 측정치(다른 측정자 것으로 바꿔 고를 수 있게)
  const selectedDeviceIds = new Set(selected.map((s) => s.device.id))
  const selectedOptions = [
    ...selected.map((s) => s.measurement),
    ...measurements.filter((m) => selectedDeviceIds.has(m.deviceId) && !selected.some((s) => s.measurement.id === m.id)),
  ]
    .map(option)
    .filter((o): o is CurveOption => o !== null)
  const currentOptions = [...ownedOptions, ...selectedOptions.filter((o) => !ownedOptions.some((x) => x.key === o.key))]
  // 들어볼 소리 후보: 비교 중인 측정치(+같은 기기의 다른 측정치) + 타깃
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
  // 들어볼 기기와 실제로 남은 차이(안전 제한 등으로 못 따라간 부분 포함). EQ 전과 비교해 얼마나 가까워졌는지 보여준다
  const before = matchError(current.curve, wish.curve, [])
  const after = matchError(current.curve, wish.curve, eq.response)
  // 안드로이드 앱: 폰 EQ는 127밴드라 필터로 바꾸지 않고 목표 곡선을 그대로(1/6옥타브까지) 건다
  const android = isAndroidApp()
  const exactCurve = targetEq(current.curve, wish.curve, FINE_GRID, EXACT_SMOOTHING).map((v) => v ?? 0)
  const afterExact = matchError(current.curve, wish.curve, exactCurve)
  const sameSource = !!current.source && current.source === wish.source
  const pair = `${current.key}|${wish.key}`

  /**
   * 같은 측정자로 맞추기: 두 기기를 같은 측정자가 잰 측정치로 바꾼다.
   * 이미 저장된 측정치를 먼저 쓰고, 없을 때만 AutoEQ·squig.link에서 받는다(sameMeasurer.ts가 고름)
   */
  async function matchMeasurer() {
    if (!current || !wish || !measurements) return
    const currentMeasurement = measurements.find((m) => m.id === current.key)
    const wishMeasurement = measurements.find((m) => m.id === wish.key)
    if (!currentMeasurement || !wishMeasurement) return
    setMatching(true)
    try {
      const sourcesOf = (deviceId: string) => measurements.filter((m) => m.deviceId === deviceId).map((m) => m.source)
      const [currentEntries, wishEntries] = await Promise.all([catalogCurvesFor(current.name), catalogCurvesFor(wish.name)])
      const pick = pickCommonSource(
        { current: currentMeasurement.source, saved: sourcesOf(currentMeasurement.deviceId), available: currentEntries.map(catalogSourceLabel) },
        { current: wishMeasurement.source, saved: sourcesOf(wishMeasurement.deviceId), available: wishEntries.map(catalogSourceLabel) },
      )
      if (!pick) {
        showToast('두 기기를 같이 잰 측정자가 없어요')
        return
      }
      // 그 측정자의 측정치 id: 저장돼 있으면 그것, 없으면 받아서 붙임(추천 측정치가 있으면 그것)
      const idFor = async (deviceId: string, entries: typeof currentEntries, fetch: boolean) => {
        if (!fetch) return measurements.find((m) => m.deviceId === deviceId && m.source === pick.source)!.id
        const mine = entries.filter((e) => catalogSourceLabel(e) === pick.source)
        const entry = mine.find((e) => e.recommended) ?? mine[0]
        return addCatalogMeasurement(deviceId, entry)
      }
      setCurrentKey(await idFor(currentMeasurement.deviceId, currentEntries, pick.fetchCurrent))
      setWishKey(await idFor(wishMeasurement.deviceId, wishEntries, pick.fetchWish))
      showToast(`${sourceLabel(pick.source)} 측정치로 맞췄어요`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '측정치를 받지 못했어요')
    } finally {
      setMatching(false)
    }
  }

  /** EQ 목록에 저장하고 저장된 id와 이름을 돌려준다(이미 저장했으면 그대로). 실패하면 null */
  async function handleSave(): Promise<{ id: string; name: string } | null> {
    if (!current || !wish) return null
    if (saved?.pair === pair) return saved
    setSaveError('')
    // EQ 화면의 자동 계산과 같은 이름 규칙("기기 → 목표")
    const name = `${current.name} → ${wish.name}`
    try {
      // 같은 "기기 → 목표" EQ가 이미 있으면 새로 만들지 않고 그것을 쓴다(같은 EQ가 쌓이지 않게)
      const same = findSamePreset(await listEqPresets(), current.key, wish.goal)
      if (same) {
        setSaved({ pair, id: same.id, name: same.name, existing: true })
        return { id: same.id, name: same.name }
      }
      const id = await addEqPreset({ name, measurementId: current.key, goal: wish.goal, filters: eq.filters, curveMode: true })
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
      const result = await applyPreset(preset.id, preset.name, { ...eq, curve: exactCurve })
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
          <Select value={current.key} onChange={(e) => setCurrentKey(e.target.value)}>
            {currentOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>
        </label>
        <span aria-hidden="true">→</span>
        <label>
          들어볼 소리{' '}
          <Select value={wish.key} onChange={(e) => setWishKey(e.target.value)}>
            {wishOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>
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
          <button type="button" className="small" disabled={matching} onClick={() => void matchMeasurer()}>
            {matching ? '맞추는 중…' : '같은 측정자로 맞추기'}
          </button>
        </p>
      )}

      <p className="eq-match" title="300Hz~8kHz, 전체 음량 차이는 빼고 모양만 비교. 안전 제한(+6/−12dB)·고음 줄임 때문에 못 따라간 부분까지 포함">
        들어볼 소리와 차이 <strong>{(android ? afterExact : after).toFixed(1)}dB</strong>
        <span className="muted small">
          {' '}
          (EQ 전 {before.toFixed(1)}dB{android && ` · 폰에는 곡선 그대로, 내보내기 필터는 ${after.toFixed(1)}dB`})
        </span>
      </p>
      <p className="small muted">
        필터 {eq.filters.length}개 · 프리앰프 {eq.preamp.toFixed(1)}dB · 필터 오차 {eq.error.toFixed(1)}dB
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
          {saveError ? <span className="error">저장하지 못했어요: {saveError}</span> : phoneMessage || (saved?.existing ? `이미 있는 EQ를 썼어요: ${saved.name}` : `저장했어요: ${saved?.name}`)}
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
