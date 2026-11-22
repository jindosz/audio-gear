// EQ 화면(왼쪽 메뉴의 "EQ"): 저장해 둔 EQ 목록 + 고르는 EQ를 편집하는 칸.
// - 목록에서 누르면 바로 그 EQ로 바뀐다. 새로 만들기·복제·삭제
// - 편집: 목표(다른 기기 측정치나 타깃)에 맞춰 자동 계산하거나, 밴드를 직접 고친다. 고친 내용은 자동 저장
// - 그래프에서 "원래 → EQ 적용 후 → 목표"를 바로 비교하고, 다 만든 EQ는 기기 전체 EQ 앱에 넣는다
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { autoPreamp, EXACT_SMOOTHING, fitPeq, targetEq, totalResponse } from '../eq'
import { isAndroidApp } from '../platform'
import { categoryLabels, rigLabels, sourceLabel } from '../labels'
import { EQ_ACTIVE_KEY, readPref, writePref } from '../localPrefs'
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
import { ChartLegend } from './ChartLegend'
import { EqBandTable } from './EqBandTable'
import { Select } from './Select'
import { EqExport } from './EqExport'
import { EqPresetPicker } from './EqPresetPicker'
import { Modal } from './Modal'
import { Help } from './Help'
import { PhoneEqControl, PhoneEqStatusBar } from './PhoneEqControl'
import { AlertIcon, ChevronDownIcon, SearchIcon } from './Icons'
import { CatalogPickDialog } from './CatalogPickDialog'
import { findSamePreset } from '../eqPresetList'
import { askConfirm } from '../confirm'

const FrChart = lazy(() => import('./FrChart').then((m) => ({ default: m.FrChart })))

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
  // 지금 고른 EQ id는 이 브라우저에 기억한다
  const [activeId, setActiveId] = useState<string>(() => readPref(EQ_ACTIVE_KEY, ''))
  // 폰: "EQ 고르기" 시트가 열려 있는지
  const [pickerOpen, setPickerOpen] = useState(false)
  useEffect(() => writePref(EQ_ACTIVE_KEY, activeId), [activeId])

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
  /** 측정치 id → 지금 쓰는 기기 이름(EQ 목록 묶음·검색용) */
  const deviceNameOf = (measurementId: string) => currentOption(options, measurementId)?.name ?? '기기 없음'

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
    if (!(await askConfirm({ title: 'EQ 삭제', message: `"${preset.name}"을(를) 삭제할까요?`, ok: '삭제', danger: true }))) return
    const rest = presets!.filter((p) => p.id !== preset.id)
    await deleteEqPreset(preset.id)
    setActiveId(rest[0]?.id ?? '')
  }

  return (
    <main className="eq-page">
      <header>
        <h2>EQ</h2>
        <Help>
          <p>EQ를 여러 개 저장해 두고 목록에서 눌러 바꿉니다. 목표를 고르고 "자동 계산"을 누르거나 밴드를 직접 고치세요. 고친 내용은 자동 저장됩니다.</p>
          <p>프리앰프는 EQ로 가장 많이 올라가는 만큼 전체 음량을 낮춘 값입니다(소리가 깨지지 않게).</p>
          <p>EQ로 바뀌는 것은 음색(주파수 응답)뿐이라 공간감·착용감 같은 차이는 따라 할 수 없습니다.</p>
        </Help>
      </header>

      {/* 안드로이드 앱: 폰 EQ가 켜져 있으면 늘 보이는 상태 줄과 끄기 */}
      <PhoneEqStatusBar />

      <div className="eq-layout">
        {/* PC: 왼쪽 칸에 EQ 목록(검색·즐겨찾기·기기별 묶음) */}
        <aside className="eq-list desktop-only">
          <EqPresetPicker
            presets={presets}
            deviceNameOf={deviceNameOf}
            activeId={active?.id}
            onSelect={setActiveId}
            onNew={handleNew}
            newDisabled={false}
          />
        </aside>

        {/* 폰: 지금 고른 EQ 이름 버튼 → 누르면 "EQ 고르기" 시트 */}
        <button type="button" className="eq-current mobile-only" onClick={() => setPickerOpen(true)}>
          <span>{active?.name ?? 'EQ 고르기'}</span>
          <ChevronDownIcon />
        </button>
        <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="EQ 고르기">
          <EqPresetPicker
            presets={presets}
            deviceNameOf={deviceNameOf}
            activeId={active?.id}
            onSelect={(id) => {
              setActiveId(id)
              setPickerOpen(false)
            }}
            onNew={async () => {
              await handleNew()
              setPickerOpen(false)
            }}
            newDisabled={false}
          />
        </Modal>

        <section className="eq-editor">
          {active ? (
            // key: 다른 EQ를 고르면 편집 칸을 새로 만들어, 고르던 EQ의 입력 중인 값이 섞이지 않게 한다
            <EqEditor
              key={active.id}
              preset={active}
              options={options}
              presets={presets}
              onOpenPreset={setActiveId}
              onDuplicate={() => handleDuplicate(active)}
              onDelete={() => handleDelete(active)}
            />
          ) : (
            <p className="muted">"새 EQ"로 시작하세요.</p>
          )}
        </section>
      </div>
    </main>
  )
}

type Draft = Pick<EqPreset, 'name' | 'measurementId' | 'goal' | 'filters' | 'curveMode'>

/** EQ 하나 편집. 고친 내용은 잠깐(0.3초) 멈췄을 때 DB에 저장한다(슬라이더를 끄는 동안 매번 저장하지 않게) */
function EqEditor({
  preset,
  options,
  presets,
  onOpenPreset,
  onDuplicate,
  onDelete,
}: {
  preset: EqPreset
  options: MeasurementOption[]
  /** 모든 EQ(같은 조합 알림용) */
  presets: EqPreset[]
  onOpenPreset: (id: string) => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const customTargets = useLiveQuery(listCustomTargets)
  const [draft, setDraft] = useState<Draft>(() => ({
    name: preset.name,
    measurementId: preset.measurementId,
    goal: preset.goal,
    filters: preset.filters,
    curveMode: preset.curveMode,
  }))
  const [loadingTarget, setLoadingTarget] = useState(false)
  const [error, setError] = useState('')
  // "다른 기기 찾기" 팝업: 어느 칸(지금 쓰는 기기/목표)을 채우는지. null이면 닫힘
  const [findFor, setFindFor] = useState<'current' | 'goal' | null>(null)

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

  const sameAs = findSamePreset(presets, draft.measurementId, draft.goal, preset.id)
  const goalTargetId = draft.goal.startsWith('t:') ? draft.goal.slice(2) : null
  const goalTarget = useLiveQuery(() => (goalTargetId ? getTarget(goalTargetId) : undefined), [goalTargetId])

  // 저장된 측정치가 하나도 없으면(처음 쓰는 경우) 없다 → [다른 기기]로 전체 기기 목록에서 받아 고른다
  const current = currentOption(options, draft.measurementId)
  const goalMeasurement = draft.goal.startsWith('m:')
    ? options.find((o) => o.measurement.id === draft.goal.slice(2))
    : undefined
  // 타깃 순서·검색에 쓰는 기기 종류: 지금 기기 → 목표 기기 → 헤드폰
  const category: DeviceCategory = current?.device.category ?? goalMeasurement?.device.category ?? 'headphone'
  const goal = goalInfo(goalMeasurement, goalTarget)

  const filters = draft.filters
  const response = totalResponse(filters, FINE_GRID)
  const preamp = autoPreamp(response, FINE_GRID)
  const before = current ? display(current.measurement.curve) : null
  const after = before?.map((v, i) => (v === null ? null : v + response[i])) ?? null
  const goalCurve = goal ? display(goal.curve) : null
  const wantedEq = goal && current ? targetEq(current.measurement.curve, goal.curve) : null
  // 폰에 걸 EQ: 자동 계산 직후(curveMode)면 목표 곡선 그대로(1/6옥타브), 아니면 밴드
  const phoneEq =
    draft.curveMode && goal && current
      ? {
          filters,
          preamp,
          curve: targetEq(current.measurement.curve, goal.curve, FINE_GRID, EXACT_SMOOTHING).map((v) => v ?? 0),
        }
      : { filters, preamp }
  // 앱에서 곡선 그대로 걸 때는 그래프에도 폰에 실제로 거는 곡선과 그 결과를 그린다(웹은 내보내기라 밴드 그대로)
  const phoneCurve = isAndroidApp() && 'curve' in phoneEq ? phoneEq.curve : null
  const phoneAfter = phoneCurve && before ? before.map((v, i) => (v === null ? null : v + phoneCurve[i])) : after

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
    // 목표가 바뀌면 밴드는 예전 목표 기준이라 곡선 그대로 걸기를 끈다(다시 자동 계산하면 켜짐)
    update({ goal: value, curveMode: false })
  }

  async function handleAuto() {
    if (!wantedEq || !goal || !current) return
    if (
      filters.length > 0 &&
      !(await askConfirm({ title: '자동 계산', message: '지금 밴드를 자동 계산 결과로 바꿀까요?', ok: '바꾸기' }))
    )
      return
    // 이름을 아직 안 바꿨으면("새 EQ 3") 무엇을 위한 EQ인지 알 수 있게 이름도 붙여 준다
    const name = /^새 EQ \d+$/.test(draft.name) ? `${current.name} → ${goal.shortName}` : draft.name
    // 자동 계산 직후엔 폰에 목표 곡선을 그대로 건다(밴드를 손대면 밴드로 돌아감)
    update({ filters: fitPeq(wantedEq).filters, name, curveMode: true })
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

      {/* 안드로이드 앱에서만 보임: 이 EQ를 폰 전체 소리에 걸기 */}
      <PhoneEqControl presetId={preset.id} name={draft.name} eq={phoneEq} />
      {isAndroidApp() && draft.curveMode && wantedEq && (
        <p className="muted small" title="폰 EQ는 127밴드라 필터 10개로 바꾸지 않고 목표 곡선을 1/6옥타브까지 그대로 걸어요. 밴드를 고치면 밴드로 걸어요. PC·Wavelet 내보내기는 밴드를 써요">
          폰에는 목표 곡선을 그대로 걸어요(밴드를 고치면 밴드로)
        </p>
      )}

      <div className="row eq-pickers">
        <div className="eq-pick-group">
          <label>
            지금 쓰는 기기{' '}
            <Select
              value={current?.measurement.id ?? ''}
              onChange={(e) => update({ measurementId: e.target.value, curveMode: false })}
            >
              {!current && (
                <option value="" disabled>
                  [다른 기기]로 찾아 주세요
                </option>
              )}
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
            </Select>
          </label>
          <button
            type="button"
            className="find-device"
            onClick={() => setFindFor('current')}
            title="전체 기기 목록에서 찾기"
          >
            <SearchIcon size={16} /> 다른 기기
          </button>
        </div>
        <span aria-hidden="true">→</span>
        <div className="eq-pick-group">
          <label>
            목표{' '}
            <Select value={draft.goal} onChange={(e) => handleGoal(e.target.value)} disabled={loadingTarget}>
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
            </Select>
          </label>
          <button
            type="button"
            className="find-device"
            onClick={() => setFindFor('goal')}
            title="전체 기기 목록에서 찾기"
          >
            <SearchIcon size={16} /> 다른 기기
          </button>
        </div>
        {loadingTarget && <span className="muted small">타깃 받는 중…</span>}
      </div>
      {error && <p className="error small">{error}</p>}
      {/* 전체 기기 목록에서 고르기. 맞은편 칸의 측정자에 맞춘다(직접 올린 측정치는 맞출 측정자가 없음) */}
      <CatalogPickDialog
        open={findFor !== null}
        onClose={() => setFindFor(null)}
        title={findFor === 'goal' ? '목표 기기 찾기' : '지금 쓰는 기기 찾기'}
        preferCategory={category}
        preferredSource={knownSource(findFor === 'goal' ? current?.measurement.source : goal?.source)}
        onPicked={(id) => {
          if (findFor === 'goal') update({ goal: `m:${id}`, curveMode: false })
          else update({ measurementId: id, curveMode: false })
          setFindFor(null)
        }}
      />
      {/* 같은 "기기 → 목표" 조합이 다른 EQ에 있으면 알려 준다(같은 EQ를 또 만들지 않게) */}
      {sameAs && (
        <p className="notice small">
          같은 조합의 EQ가 있어요: <strong>{sameAs.name}</strong>{' '}
          <button type="button" className="link" onClick={() => onOpenPreset(sameAs.id)}>
            열기
          </button>
        </p>
      )}

      {goal && goal.category !== category && (
        <p className="warning small" title="헤드폰과 이어폰은 측정 방식이 달라 EQ 결과가 부정확합니다">
          <AlertIcon size={15} /> {categoryLabels[category]}↔{categoryLabels[goal.category]}: 결과가 부정확할 수 있어요
        </p>
      )}
      {current && goal?.source && goal.source !== current.measurement.source && (
        <p
          className="warning small"
          title={`${sourceLabel(current.measurement.source)} / ${sourceLabel(goal.source)} — 측정 환경 차이까지 EQ에 섞이므로 같은 측정자를 고르는 것이 좋습니다`}
        >
          <AlertIcon size={15} /> 측정자가 달라요
        </p>
      )}

      {current && before && after ? (
        <>
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
                  { label: phoneCurve ? '폰에 걸면' : 'EQ 적용 후', colorIndex: 0, values: phoneCurve && phoneAfter ? phoneAfter : after },
                  ...(goal && goalCurve ? [{ label: goal.label, colorIndex: null, values: goalCurve }] : []),
                ]}
                yTitle="dB (300Hz~3kHz 평균 = 0)"
              />
            </Suspense>
          </div>
        </>
      ) : (
        // 처음 쓰는 경우: 저장된 기기가 없어도 [다른 기기]로 전체 목록에서 찾아 받으면 된다
        <p className="notice">
          지금 쓰는 기기를 골라 주세요. 옆의{' '}
          <button type="button" className="link" onClick={() => setFindFor('current')}>
            다른 기기
          </button>
          로 전체 목록에서 찾아 받을 수 있어요.
        </p>
      )}
      <div className="eq-chart small-chart">
        <Suspense fallback={null}>
          <FrChart
            grid={FINE_GRID}
            series={[
              ...(phoneCurve ? [{ label: '폰에 거는 EQ', colorIndex: 2, values: phoneCurve }] : []),
              { label: phoneCurve ? '밴드(내보내기)' : '만든 EQ', colorIndex: 0, values: response },
              ...(wantedEq ? [{ label: '목표까지 필요한 EQ', colorIndex: null, values: wantedEq }] : []),
            ]}
            yTitle="EQ (dB)"
            signed
          />
        </Suspense>
      </div>
      {/* 앱에서 곡선 그대로 걸 때만 곡선이 3개라 어느 게 무엇인지 범례로 */}
      {phoneCurve && (
        <ChartLegend
          items={[
            { label: '폰에 거는 EQ', colorIndex: 2 },
            { label: '밴드(내보내기)', colorIndex: 0 },
            ...(wantedEq ? [{ label: '목표까지 필요한 EQ', colorIndex: null }] : []),
          ]}
        />
      )}

      <div className="row">
        <button
          type="button"
          className="primary"
          onClick={handleAuto}
          disabled={!wantedEq}
          title={!current ? '지금 쓰는 기기를 먼저 고르세요' : wantedEq ? undefined : '목표를 먼저 고르세요'}
        >
          목표에 맞춰 자동 계산
        </button>
        <span className="small muted">
          밴드 {filters.length}개 · 프리앰프 {preamp.toFixed(1)}dB
          {remaining !== null && ` · 남은 차이 ${remaining.toFixed(1)}dB`}
        </span>
      </div>

      <EqBandTable filters={filters} onChange={(f) => update({ filters: f, curveMode: false })} />

      {filters.length > 0 && <EqExport eq={{ filters, preamp }} name={draft.name} />}
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

/** 측정자로 맞출 수 있는 출처만(직접 올린 측정치·타깃은 null) */
function knownSource(source: string | undefined): string | null {
  return source && source !== 'local' ? source : null
}

function rms(values: (number | null)[]): number {
  const v = values.filter((x): x is number => x !== null)
  return v.length ? Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length) : 0
}
