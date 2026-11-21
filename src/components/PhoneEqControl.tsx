// 안드로이드 앱의 "폰 전체 EQ" 화면 부품 두 개. 일반 브라우저(배포 사이트)에서는 아무것도 그리지 않는다.
// 실제로 거는 일은 EQ 엔진 창구(eqEngine.ts)가 한다.
// - PhoneEqStatusBar: EQ 화면 맨 위. 폰 EQ가 켜져 있으면 무엇이 걸렸는지와 "끄기"를 늘 보여준다
//   (EQ 목록을 다 지워도 앱 안에서 끌 수 있게)
// - PhoneEqControl: 편집 칸. [폰에 적용] 켜고 끄기. 걸어 둔 EQ를 고치면 0.3초 멈춘 뒤 폰에도 자동으로 다시 건다(끊김 없음)
//   아래에 적용할 앱 [모든 앱 | 고른 앱만]과, 고른 앱만일 때 고를 수 있는 앱 목록(PhoneEqTargets)
import { useEffect, useState } from 'react'
import {
  applyPreset,
  eqSignature,
  getEqEngine,
  turnOffPhoneEq,
  useAppliedEq,
  useEqStatus,
  type EqStatus,
  type EqTargetMode,
  type EqTargets,
} from '../eqEngine'
import type { EqSettings } from '../eqExport'
import { Help } from './Help'
import { SegmentedGroup } from './SegmentedGroup'
import { ToggleButton } from './ToggleButton'

/** 버튼을 누르는 동안의 상태와 오류를 함께 다룬다 */
function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function run(action: () => Promise<{ error?: string }>) {
    setBusy(true)
    setError('')
    try {
      const result = await action()
      if (result.error) setError(result.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}

export function PhoneEqStatusBar() {
  const status = useEqStatus()
  const { busy, error, run } = useAction()
  if (getEqEngine().kind === 'none' || !status?.on) return null
  return (
    <div className="phone-eq-status small">
      <span>
        지금 폰에 적용 중: <strong>{status.name}</strong>
        {status.mode === 'sessions' && ' (재생 앱 신호 방식)'}
        {status.mode === 'apps' && ' (고른 앱만)'}
      </span>
      <button type="button" onClick={() => run(turnOffPhoneEq)} disabled={busy}>
        끄기
      </button>
      {error && <span className="error">{error}</span>}
    </div>
  )
}

interface Props {
  presetId: string
  name: string
  eq: EqSettings
}

/** 고친 뒤 이만큼 멈추면 폰에 다시 건다(EQ 자동 저장과 같은 간격) */
const AUTO_APPLY_MS = 300

export function PhoneEqControl({ presetId, name, eq }: Props) {
  const status = useEqStatus()
  const applied = useAppliedEq(status)
  const { busy, error, run } = useAction()
  const [autoError, setAutoError] = useState('')

  const on = applied?.id === presetId
  // 걸어 둔 뒤 이름·밴드·프리앰프를 고쳤으면 폰에는 아직 예전 값이 걸려 있다 → 잠깐 멈추면 자동으로 다시 건다.
  // 값만 바꿔 거는 방식이라 소리가 끊기지 않는다(폴드7에서 0.3초 간격 변경 시험 완료)
  const signature = eqSignature(name, eq)
  const changed = on && applied.signature !== signature
  useEffect(() => {
    if (!changed) return
    const timer = setTimeout(() => {
      applyPreset(presetId, name, eq)
        .then((r) => setAutoError(r.error ?? ''))
        .catch((err) => setAutoError(err instanceof Error ? err.message : String(err)))
    }, AUTO_APPLY_MS)
    return () => clearTimeout(timer)
    // eq·name은 signature에 모두 담겨 있어서 signature가 바뀔 때만 다시 건다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changed, signature, presetId])

  if (getEqEngine().kind === 'none') return null

  return (
    <div className="phone-eq">
      <ToggleButton
        on={on}
        onChange={(next) => !busy && run(() => (next ? applyPreset(presetId, name, eq) : turnOffPhoneEq()))}
        title="이 EQ를 폰 전체 소리(스포티파이 등)에 겁니다"
      >
        {busy ? '적용 중…' : on ? '폰에 적용 중' : '폰에 적용'}
      </ToggleButton>
      {on && <span className="small muted">고치면 폰에도 바로 반영됩니다</span>}
      {(error || autoError || status?.error) && <p className="error small">{error || autoError || status?.error}</p>}
      <PhoneEqTargets status={status} />
    </div>
  )
}

/**
 * 적용할 앱: [모든 앱 | 고른 앱만]. 고른 앱만이면 "재생 신호를 보낸 적 있는 앱"을 켜고 끈다.
 * 바꾸면 바로 저장되고, EQ가 켜져 있으면 이미 재생 중인 앱에도 바로 붙거나 떨어진다
 */
function PhoneEqTargets({ status }: { status: EqStatus | null }) {
  const [targets, setTargets] = useState<EqTargets | null>(null)
  const [error, setError] = useState('')

  // 상태가 바뀔 때마다(새 앱이 신호를 보낸 경우 포함) 목록을 다시 읽는다
  useEffect(() => {
    let alive = true
    getEqEngine()
      .targets()
      .then((t) => alive && setTargets(t))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [status])

  if (!targets) return null

  function save(mode: EqTargetMode, apps: string[]) {
    setTargets((t) => (t ? { ...t, mode, apps } : t))
    setError('')
    getEqEngine()
      .setTargets(mode, apps)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
  }

  const chosen = new Set(targets.apps)
  const toggleApp = (pkg: string, on: boolean) =>
    save('apps', on ? [...targets.apps, pkg] : targets.apps.filter((p) => p !== pkg))

  return (
    <div className="phone-eq-targets">
      <div className="row">
        <span className="small">적용할 앱</span>
        <SegmentedGroup className="small" label="적용할 앱">
          <button type="button" className={targets.mode === 'all' ? 'active' : undefined} onClick={() => save('all', targets.apps)}>
            모든 앱
          </button>
          <button type="button" className={targets.mode === 'apps' ? 'active' : undefined} onClick={() => save('apps', targets.apps)}>
            고른 앱만
          </button>
        </SegmentedGroup>
      </div>
      {targets.mode === 'apps' && (
        <>
          {targets.seen.length === 0 ? (
            <p className="muted small">아직 고를 수 있는 앱이 없어요. [모든 앱]으로 폰에 적용한 채 음악 앱에서 재생해 보세요.</p>
          ) : (
            <div className="row phone-eq-apps">
              {targets.seen.map((app) => (
                <ToggleButton key={app.package} small on={chosen.has(app.package)} onChange={(on) => toggleApp(app.package, on)}>
                  {app.label}
                </ToggleButton>
              ))}
            </div>
          )}
          {targets.seen.length > 0 && targets.apps.length === 0 && (
            <p className="warning small">고른 앱이 없어서 지금은 어디에도 걸리지 않아요</p>
          )}
        </>
      )}
      {error && <p className="error small">{error}</p>}
      <Help>
        <p>
          고른 앱만은 재생할 때 신호를 보내는 앱(스포티파이·유튜브 뮤직 등)에만 돼요. 목록에는 폰 EQ가 켜져 있는 동안 재생한 적
          있는 앱이 쌓여요. 목록에 안 나오는 앱은 신호를 보내지 않는 앱이에요.
        </p>
        <p>설정을 바꾼 뒤 걸리지 않으면 음악 앱에서 일시정지 후 다시 재생하거나 앱을 다시 켜 보세요.</p>
      </Help>
    </div>
  )
}
