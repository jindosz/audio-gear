// EQ 화면(왼쪽 메뉴의 "EQ"): 저장해 둔 EQ 목록 + 고르는 EQ를 편집하는 칸.
// - 목록에서 누르면 바로 그 EQ로 바뀐다. 새로 만들기·복제·삭제
// - 편집: 목표(다른 기기 측정치나 타깃)에 맞춰 자동 계산하거나, 밴드를 직접 고친다. 고친 내용은 자동 저장
// - 그래프에서 "원래 → EQ 적용 후 → 목표"를 바로 비교하고, 다 만든 EQ는 기기 전체 EQ 앱에 넣는다
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { autoPreamp, fitPeq, targetEq, totalResponse } from '../eq'
import { categoryLabels, rigLabels, sourceLabel } from '../labels'
import { readPref, writePref } from '../localPrefs'
import {
  addEqPreset,
  deleteEqPreset,
  getTarget,
  listCustomTargets,
  listDevices,
  listEqPresets,
  listMeasurements,
  updateEqPreset,
} from '../repo'
import { seriesColor } from '../selection'
import { FINE_GRID, prepare } from '../similarity'
import { BUILTIN_TARGETS, ensureTarget } from '../targets'
import type { Device, DeviceCategory, EqPreset, FrCurve, Measurement, Target } from '../types'
import { EqBandTable } from './EqBandTable'
import { EqExport } from './EqExport'

const FrChart = lazy(() => import('./FrChart').then((m) => ({ default: m.FrChart })))

/** 지금 고른 EQ id는 이 브라우저에 기억한다 */
const ACTIVE_KEY = 'eq.active'
/** 목록이 생기기 전, 편집 중이던 EQ 하나를 localStorage에 두던 자리(처음 한 번 목록으로 옮긴다) */
const OLD_KEY = 'eq.page'

/** 고를 수 있는 기기 측정치 하나 */
interface MeasurementOption {
  measurement: Measurement
  device: Device
  /** 기기 이름 */
  name: string
  /** 기기 이름 · 출처 (구성) */
  label: string
}

/** 그래프용 곡선: 300Hz~3kHz 평균을 0dB로 맞추고 1/24옥타브로 살짝 다듬는다 */
const display = (curve: FrCurve) => prepare(curve, FINE_GRID, 24)

/** 구성 설명을 이름 뒤에 괄호로. 이미 괄호로 싸여 있으면 그대로 */
function variantSuffix(variant: string): string {
  if (!variant) return ''
  return variant.startsWith('(') ? ` ${variant}` : ` (${variant})`
}

/** EQ를 걸 기기 측정치. 저장된 측정치가 지워졌거나 비어 있으면 첫 보유 기기 측정치로 본다 */
function currentOption(options: MeasurementOption[], measurementId: string): MeasurementOption | undefined {
  return options.find((o) => o.measurement.id === measurementId) ?? options.find((o) => o.device.owned) ?? options[0]
}

export function EqPage() {
  const presets = useLiveQuery(listEqPresets)
  const devices = useLiveQuery(listDevices)
  const measurements = useLiveQuery(listMeasurements)
  const [activeId, setActiveId] = useState<string>(() => readPref(ACTIVE_KEY, ''))
  useEffect(() => writePref(ACTIVE_KEY, activeId), [activeId])

  // 예전 방식(EQ 하나를 localStorage에 기억)으로 만들던 EQ가 있으면 목록의 첫 EQ로 옮긴다
  const migrated = useRef(false)
  useEffect(() => {
    if (!presets || migrated.current) return
    migrated.current = true
    const old = readPref<{ currentId?: string; goal?: string; filters?: EqPreset['filters'] } | null>(OLD_KEY, null)
    if (!old) return
    writePref(OLD_KEY, null)
    if (presets.length === 0 && old.filters?.length) {
      addEqPreset({ name: 'EQ 1', measurementId: old.currentId ?? '', goal: old.goal ?? '', filters: old.filters }).then(setActiveId)
    }
  }, [presets])

  if (!presets || !devices || !measurements) return <main className="eq-page muted">불러오는 중…</main>

  // 측정치 선택지: 이름순. 보유 기기 측정치는 편집 칸에서 따로 모아 먼저 보여준다
  const deviceById = new Map(devices.map((d) => [d.id, d]))
  const options: MeasurementOption[] = measurements
    .flatMap((m) => {
      const d = deviceById.get(m.deviceId)
      if (!d) return []
      const name = `${d.brand} ${d.model}`
      return [{ measurement: m, device: d, name, label: `${name} · ${sourceLabel(m.source)}${variantSuffix(m.variant)}` }]
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  const active = presets.find((p) => p.id === activeId) ?? presets[0]

  async function handleNew() {
    // 새 EQ는 첫 보유 기기 측정치에 빈 밴드로 시작한다
    const first = currentOption(options, '')
    const id = await addEqPreset({
      name: `새 EQ ${presets!.length + 1}`,
      measurementId: first?.measurement.id ?? '',
      goal: '',
      filters: [],
    })
    setActiveId(id)
  }

  async function handleDuplicate(preset: EqPreset) {
    const { name, measurementId, goal, filters } = preset
    setActiveId(await addEqPreset({ name: `${name} 복사본`, measurementId, goal, filters }))
  }

  async function handleDelete(preset: EqPreset) {
    if (!confirm(`"${preset.name}"을(를) 삭제할까요?`)) return
    const rest = presets!.filter((p) => p.id !== preset.id)
    await deleteEqPreset(preset.id)
    setActiveId(rest[0]?.id ?? '')
  }

  return (
    <main className="eq-page">
      <header>
        <h2>EQ</h2>
        <p className="muted small">
          EQ를 여러 개 만들어 저장해 두고, 목록에서 눌러 바꿉니다. 목표에 맞춰 자동으로 만들거나 밴드를 직접 고칠 수 있고,
          고친 내용은 자동으로 저장됩니다.
        </p>
      </header>

      <div className="eq-layout">
        <aside className="eq-list">
          <button type="button" className="primary" onClick={handleNew} disabled={options.length === 0}>
            + 새 EQ
          </button>
          <ul>
            {presets.map((p) => {
              const device = currentOption(options, p.measurementId)
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={p === active ? 'eq-item active' : 'eq-item'}
                    aria-pressed={p === active}
                    onClick={() => setActiveId(p.id)}
                  >
                    <span className="eq-item-name">{p.name}</span>
                    <span className="muted small">
                      {device?.name ?? '기기 없음'} · 밴드 {p.filters.length}개
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {presets.length === 0 && <p className="muted small">저장한 EQ가 없습니다. "+ 새 EQ"로 만들어 보세요.</p>}
        </aside>

        <section className="eq-editor">
          {options.length === 0 ? (
            <p className="muted">
              저장된 측정치가 없습니다. 기기 목록에서 지금 쓰는 기기를 눌러 측정치를 받고, ⋯ 버튼에서 "보유"로 표시해 주세요.
            </p>
          ) : active ? (
            // key: 다른 EQ를 고르면 편집 칸을 새로 만들어, 고르던 EQ의 입력 중인 값이 섞이지 않게 한다
            <EqEditor
              key={active.id}
              preset={active}
              options={options}
              onDuplicate={() => handleDuplicate(active)}
              onDelete={() => handleDelete(active)}
            />
          ) : (
            <p className="muted">왼쪽에서 "+ 새 EQ"를 눌러 시작하세요.</p>
          )}
        </section>
      </div>
    </main>
  )
}

type Draft = Pick<EqPreset, 'name' | 'measurementId' | 'goal' | 'filters'>

/** EQ 하나 편집. 고친 내용은 잠깐(0.3초) 멈췄을 때 DB에 저장한다(슬라이더를 끄는 동안 매번 저장하지 않게) */
function EqEditor({
  preset,
  options,
  onDuplicate,
  onDelete,
}: {
  preset: EqPreset
  options: MeasurementOption[]
  onDuplicate: () => void
  onDelete: () => void
}) {
  const customTargets = useLiveQuery(listCustomTargets)
  const [draft, setDraft] = useState<Draft>(() => ({
    name: preset.name,
    measurementId: preset.measurementId,
    goal: preset.goal,
    filters: preset.filters,
  }))
  const [loadingTarget, setLoadingTarget] = useState(false)
  const [error, setError] = useState('')

  // 자동 저장: 아직 저장하지 않은 고친 내용. 마지막으로 고친 뒤 0.3초가 지나면 저장하고,
  // 그 전에 다른 EQ로 바꾸면(편집 칸이 사라지면) 바로 저장한다
  const unsaved = useRef<Draft | null>(null)
  const changed = useRef(false) // 처음 화면을 그릴 때는 저장된 값 그대로라 저장하지 않는다
  useEffect(() => {
    if (!changed.current) return
    unsaved.current = draft
    const timer = setTimeout(() => {
      updateEqPreset(preset.id, draft)
      unsaved.current = null
    }, 300)
    return () => clearTimeout(timer)
  }, [draft, preset.id])
  useEffect(
    () => () => {
      if (unsaved.current) updateEqPreset(preset.id, unsaved.current)
    },
    [preset.id],
  )

  const update = (patch: Partial<Draft>) => {
    changed.current = true
    setDraft((d) => ({ ...d, ...patch }))
  }

  const goalTargetId = draft.goal.startsWith('t:') ? draft.goal.slice(2) : null
  const goalTarget = useLiveQuery(() => (goalTargetId ? getTarget(goalTargetId) : undefined), [goalTargetId])

  // EqPage가 측정치가 하나라도 있을 때만 이 칸을 그리므로 항상 있다
  const current = currentOption(options, draft.measurementId)!
  const category: DeviceCategory = current.device.category
  const goalMeasurement = draft.goal.startsWith('m:')
    ? options.find((o) => o.measurement.id === draft.goal.slice(2))
    : undefined
  const goal = goalInfo(goalMeasurement, goalTarget)

  const filters = draft.filters
  const response = totalResponse(filters, FINE_GRID)
  const preamp = autoPreamp(response, FINE_GRID)
  const before = display(current.measurement.curve)
  const after = before.map((v, i) => (v === null ? null : v + response[i]))
  const goalCurve = goal ? display(goal.curve) : null
  const wantedEq = goal ? targetEq(current.measurement.curve, goal.curve) : null

  async function handleGoal(value: string) {
    setError('')
    if (value.startsWith('t:')) {
      // 기본 타깃을 처음 고르면 이때 받아서 저장한다
      setLoadingTarget(true)
      try {
        await ensureTarget(value.slice(2))
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        return
      } finally {
        setLoadingTarget(false)
      }
    }
    update({ goal: value })
  }

  function handleAuto() {
    if (!wantedEq || !goal) return
    if (filters.length > 0 && !confirm('지금 밴드를 자동 계산 결과로 바꿉니다. 계속할까요?')) return
    // 이름을 아직 안 바꿨으면("새 EQ 3") 무엇을 위한 EQ인지 알 수 있게 이름도 붙여 준다
    const name = /^새 EQ \d+$/.test(draft.name) ? `${current.name} → ${goal.shortName}` : draft.name
    update({ filters: fitPeq(wantedEq).filters, name })
  }

  // 목표와 남은 차이(dB, 20Hz~12kHz 평균 제곱근). 자동 계산이 따라가는 범위와 같다
  const remaining = wantedEq
    ? rms(wantedEq.map((t, i) => (t === null || FINE_GRID[i] > 12000 ? null : t - response[i])))
    : null

  const ownedOptions = options.filter((o) => o.device.owned)
  const otherOptions = options.filter((o) => !o.device.owned)
  const targetGroups = [category, category === 'headphone' ? 'iem' : 'headphone'] as const

  return (
    <>
      <div className="row">
        <input
          className="eq-name"
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          aria-label="EQ 이름"
          placeholder="EQ 이름"
        />
        <button type="button" onClick={onDuplicate}>
          복제
        </button>
        <button type="button" className="danger" onClick={onDelete}>
          삭제
        </button>
      </div>

      <div className="row eq-pickers">
        <label>
          지금 쓰는 기기{' '}
          <select value={current.measurement.id} onChange={(e) => update({ measurementId: e.target.value })}>
            {ownedOptions.length > 0 && (
              <optgroup label="보유 기기">
                {ownedOptions.map((o) => (
                  <option key={o.measurement.id} value={o.measurement.id}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            )}
            {otherOptions.length > 0 && (
              <optgroup label="그 밖의 내 기기">
                {otherOptions.map((o) => (
                  <option key={o.measurement.id} value={o.measurement.id}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <span aria-hidden="true">→</span>
        <label>
          목표{' '}
          <select value={draft.goal} onChange={(e) => handleGoal(e.target.value)} disabled={loadingTarget}>
            <option value="">없음 (직접 조정)</option>
            <optgroup label="기기 측정치">
              {options
                .filter((o) => o !== current)
                .map((o) => (
                  <option key={o.measurement.id} value={`m:${o.measurement.id}`}>
                    {o.label}
                  </option>
                ))}
            </optgroup>
            {customTargets && customTargets.length > 0 && (
              <optgroup label="내 타깃">
                {customTargets.map((t) => (
                  <option key={t.id} value={`t:${t.id}`}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
            {targetGroups.map((c) => (
              <optgroup key={c} label={`${categoryLabels[c]} 타깃`}>
                {BUILTIN_TARGETS.filter((t) => t.category === c).map((t) => (
                  <option key={t.id} value={`t:${t.id}`}>
                    {t.name} ({rigLabels[t.rig]})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {loadingTarget && <span className="muted small">타깃 받는 중…</span>}
      </div>
      {error && <p className="error small">{error}</p>}

      {goal && goal.category !== category && (
        <p className="warning small">
          ⚠ {categoryLabels[category]}과 {categoryLabels[goal.category]}은 측정 방식이 달라 EQ 결과가 부정확합니다.
        </p>
      )}
      {goal?.source && goal.source !== current.measurement.source && (
        <p className="warning small">
          ⚠ 두 측정치의 측정자가 다릅니다({sourceLabel(current.measurement.source)} / {sourceLabel(goal.source)}). 측정 환경
          차이까지 EQ에 섞이므로, 가능하면 같은 측정자 측정치를 고르세요.
        </p>
      )}

      <ul className="legend">
        <li style={{ '--c': seriesColor(1) } as CSSProperties}>
          <span className="swatch" aria-hidden="true" />
          원래: {current.label}
        </li>
        <li style={{ '--c': seriesColor(0) } as CSSProperties}>
          <span className="swatch" aria-hidden="true" />
          EQ 적용 후
        </li>
        {goal && (
          <li>
            <span className="swatch target" aria-hidden="true" />
            목표: {goal.label}
          </li>
        )}
      </ul>
      <div className="eq-chart">
        <Suspense fallback={<p className="muted">그래프 불러오는 중…</p>}>
          <FrChart
            grid={FINE_GRID}
            series={[
              { label: '원래', colorIndex: 1, values: before },
              { label: 'EQ 적용 후', colorIndex: 0, values: after },
              ...(goal && goalCurve ? [{ label: goal.label, colorIndex: null, values: goalCurve }] : []),
            ]}
            yTitle="dB (300Hz~3kHz 평균 = 0)"
          />
        </Suspense>
      </div>
      <div className="eq-chart small-chart">
        <Suspense fallback={null}>
          <FrChart
            grid={FINE_GRID}
            series={[
              { label: '만든 EQ', colorIndex: 0, values: response },
              ...(wantedEq ? [{ label: '목표까지 필요한 EQ', colorIndex: null, values: wantedEq }] : []),
            ]}
            yTitle="EQ (dB)"
            signed
          />
        </Suspense>
      </div>

      <div className="row">
        <button
          type="button"
          className="primary"
          onClick={handleAuto}
          disabled={!wantedEq}
          title={wantedEq ? undefined : '목표를 먼저 고르세요'}
        >
          목표에 맞춰 자동 계산
        </button>
        <span className="small">
          밴드 {filters.length}개 · 프리앰프 {preamp.toFixed(1)}dB
          {remaining !== null && ` · 목표와 남은 차이 ${remaining.toFixed(1)}dB`}
        </span>
      </div>

      <EqBandTable filters={filters} onChange={(f) => update({ filters: f })} />

      {filters.length > 0 && <EqExport eq={{ filters, preamp }} name={draft.name} />}
      <p className="muted small">
        프리앰프는 EQ로 가장 많이 올라가는 만큼 전체 음량을 낮춘 값입니다(소리가 깨지지 않게). EQ로 바뀌는 것은 주파수
        응답(음색)뿐이라, 공간감·착용감 같은 차이는 따라 할 수 없습니다.
      </p>
    </>
  )
}

/** 목표(기기 측정치 또는 타깃)를 그래프·경고에 쓰기 좋은 모양으로 */
function goalInfo(measurement: MeasurementOption | undefined, target: Target | undefined) {
  if (measurement) {
    return {
      label: measurement.label,
      shortName: measurement.name,
      curve: measurement.measurement.curve,
      category: measurement.device.category,
      source: measurement.measurement.source as string | undefined,
    }
  }
  if (target) {
    return { label: `타깃: ${target.name}`, shortName: target.name, curve: target.curve, category: target.category, source: undefined }
  }
  return undefined
}

function rms(values: (number | null)[]): number {
  const v = values.filter((x): x is number => x !== null)
  return v.length ? Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length) : 0
}
