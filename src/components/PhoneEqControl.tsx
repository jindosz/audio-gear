// 안드로이드 앱의 "폰 전체 EQ" 화면 부품 두 개. 일반 브라우저(배포 사이트)에서는 아무것도 그리지 않는다.
// 실제로 거는 일은 EQ 엔진 창구(eqEngine.ts)가 한다.
// - PhoneEqStatusBar: EQ 화면 맨 위. 폰 EQ가 켜져 있으면 무엇이 걸렸는지와 "끄기"를 늘 보여준다
//   (EQ 목록을 다 지워도 앱 안에서 끌 수 있게)
// - PhoneEqControl: 편집 칸. [폰에 적용] 켜고 끄기, 걸어 둔 뒤 고쳤으면 "변경 사항 적용"
import { useState } from 'react'
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

export function PhoneEqControl({ presetId, name, eq }: Props) {
  const status = useEqStatus()
  const applied = useAppliedEq(status)
  const { busy, error, run } = useAction()
  if (getEqEngine().kind === 'none') return null

  const on = applied?.id === presetId
  // 걸어 둔 뒤 이름·밴드·프리앰프를 고쳤으면 폰에는 아직 예전 값이 걸려 있다
  const changed = on && applied.signature !== eqSignature(name, eq)

  return (
    <div className="phone-eq">
      <ToggleButton
        on={on}
        onChange={(next) => !busy && run(() => (next ? applyPreset(presetId, name, eq) : turnOffPhoneEq()))}
        title="이 EQ를 폰 전체 소리(스포티파이 등)에 겁니다"
      >
        {busy ? '적용 중…' : on ? '폰에 적용 중' : '폰에 적용'}
      </ToggleButton>
      {changed && (
        <button type="button" className="primary" onClick={() => run(() => applyPreset(presetId, name, eq))} disabled={busy}>
          변경 사항 적용
        </button>
      )}
      {changed && <span className="small muted">고친 내용은 아직 폰에 걸리지 않았습니다</span>}
      {(error || status?.error) && <p className="error small">{error || status?.error}</p>}
    </div>
  )
}
