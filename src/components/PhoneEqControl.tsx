// EQ 화면의 [폰에 적용]: 안드로이드 앱에서 지금 보고 있는 EQ를 폰 전체 소리에 건다.
// 일반 브라우저(배포 사이트)에서는 다른 앱 소리를 바꿀 수 없어 아무것도 그리지 않는다.
// 실제로 거는 일은 EQ 엔진 창구(eqEngine.ts)가 한다
import { useState } from 'react'
import { getEqEngine, useEqStatus } from '../eqEngine'
import type { EqSettings } from '../eqExport'
import { EQ_APPLIED_KEY, readPref, writePref } from '../localPrefs'
import { ToggleButton } from './ToggleButton'

interface Props {
  presetId: string
  name: string
  eq: EqSettings
}

export function PhoneEqControl({ presetId, name, eq }: Props) {
  const engine = getEqEngine()
  const status = useEqStatus()
  // 폰에 걸려 있는 EQ가 어느 것인지(이름은 바뀔 수 있어 id로 기억한다)
  const [appliedId, setAppliedId] = useState(() => readPref<string | null>(EQ_APPLIED_KEY, null))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (engine.kind === 'none') return null

  const on = !!status?.on && appliedId === presetId

  async function handleToggle(next: boolean) {
    setBusy(true)
    setError('')
    try {
      const result = next ? await engine.apply(name, eq) : await engine.off()
      if (result.error) setError(result.error)
      const id = next && result.on ? presetId : null
      setAppliedId(id)
      writePref(EQ_APPLIED_KEY, id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleOff() {
    await handleToggle(false)
  }

  return (
    <div className="phone-eq">
      <ToggleButton on={on} onChange={(next) => !busy && handleToggle(next)} title="이 EQ를 폰 전체 소리(스포티파이 등)에 겁니다">
        {busy ? '적용 중…' : on ? '폰에 적용 중' : '폰에 적용'}
      </ToggleButton>
      <span className="small muted">
        {status?.on ? (
          <>
            지금 폰에 적용 중: <strong>{status.name}</strong>
            {status.mode === 'sessions' && ' (재생 앱 신호 방식)'}
            {!on && (
              <>
                {' · '}
                <button type="button" className="link-btn" onClick={handleOff} disabled={busy}>
                  끄기
                </button>
              </>
            )}
          </>
        ) : (
          '폰 EQ 꺼짐'
        )}
      </span>
      {(error || status?.error) && <p className="error small">{error || status?.error}</p>}
    </div>
  )
}
