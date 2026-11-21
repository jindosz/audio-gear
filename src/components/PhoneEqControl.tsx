// 안드로이드 앱의 "폰 전체 EQ" 화면 부품 두 개. 일반 브라우저(배포 사이트)에서는 아무것도 그리지 않는다.
// 실제로 거는 일은 EQ 엔진 창구(eqEngine.ts)가 한다.
// - PhoneEqStatusBar: EQ 화면 맨 위. 폰 EQ가 켜져 있으면 무엇이 걸렸는지와 "끄기"를 늘 보여준다
//   (EQ 목록을 다 지워도 앱 안에서 끌 수 있게)
// - PhoneEqControl: 편집 칸. [폰에 적용] 켜고 끄기. 걸어 둔 EQ를 고치면 0.3초 멈춘 뒤 폰에도 자동으로 다시 건다(끊김 없음)
import { useEffect, useState } from 'react'
import { applyPreset, eqSignature, getEqEngine, turnOffPhoneEq, useAppliedEq, useEqStatus } from '../eqEngine'
import type { EqSettings } from '../eqExport'
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
    </div>
  )
}
