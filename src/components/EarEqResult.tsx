// 내 귀 보정 결과: 귀마다 덜 들리는 정도와 올릴 양 그래프, 세기 슬라이더, 경고, [저장하고 적용].
// 측정 팝업(EarEqDialog) 끝과 설정의 [결과]에서 함께 쓴다
import { lazy, Suspense, useState } from 'react'
import { relativeLoss, type EarProfile } from '../earEq'
import { earBoosts } from '../earEqStore'
import { earWarnings, RECHECK_FREQ } from '../hearingTest'
import { sourceLabel } from '../labels'
import { isAndroidApp } from '../platform'
import { seriesColor } from '../selection'
import { Help } from './Help'

const FrChart = lazy(() => import('./FrChart').then((m) => ({ default: m.FrChart })))

interface Props {
  profile: EarProfile
  /** 첫 1kHz 역치(왼쪽·오른쪽). 막 잰 결과일 때만(흔들림 경고용) */
  firstAt1k?: { left: number | null; right: number | null }
  /** 저장 버튼 글자 */
  saveLabel?: string
  onSave: (p: EarProfile) => void
  onRetry?: () => void
}

export function EarEqResult({ profile, firstAt1k, saveLabel, onSave, onRetry }: Props) {
  const [strength, setStrength] = useState(profile.strength)
  const freqs = profile.left.freqs
  const loss = (side: 'left' | 'right') => relativeLoss(freqs, profile[side].thresholds)
  const boost = (side: 'left' | 'right') => earBoosts(profile[side], profile.offset, strength)
  const warn = (side: 'left' | 'right') =>
    earWarnings(profile[side], firstAt1k?.[side] ?? profile[side].thresholds[freqs.indexOf(RECHECK_FREQ)])
  const warnings = (['left', 'right'] as const).flatMap((side) => {
    const w = warn(side)
    const ear = side === 'left' ? '왼쪽' : '오른쪽'
    return [
      ...(w.falseAlarms ? [`${ear} 귀: 소리가 없을 때 누른 적이 많아요`] : []),
      ...(w.unstable ? [`${ear} 귀: 결과가 흔들려요. 다시 재 보면 더 정확해요`] : []),
      ...(profile[side].atLimit.some(Boolean) ? [`${ear} 귀: 가장 크게 해도 안 들린 소리가 있어요`] : []),
    ]
  })
  const big = (['left', 'right'] as const).some((side) => loss(side).some((v) => v !== null && v >= 25))

  return (
    <div className="ear-eq-result">
      <p className="muted small">
        정상 귀보다 덜 들리는 정도(위)와 올릴 양(아래)
        {profile.device ? ` · 기기 몫: ${profile.device.label}${profile.device.source ? ` (${sourceLabel(profile.device.source)})` : ''}` : ' · 기기 몫 빼지 않음'}
      </p>
      <p className="ear-eq-legend small">
        <span>
          <i style={{ background: seriesColor(0) }} /> 왼쪽 귀
        </span>
        <span>
          <i style={{ background: seriesColor(1) }} /> 오른쪽 귀
        </span>
      </p>
      <Suspense fallback={<div className="ear-eq-chart muted">그래프 불러오는 중…</div>}>
        <FrChart
          className="ear-eq-chart"
          grid={freqs}
          series={[
            { label: '왼쪽 귀', colorIndex: 0, values: loss('left') },
            { label: '오른쪽 귀', colorIndex: 1, values: loss('right') },
          ]}
          yTitle="덜 들림 (dB)"
          signed
        />
        <FrChart
          className="ear-eq-chart small-chart"
          grid={freqs}
          series={[
            { label: '왼쪽 올림', colorIndex: 0, values: boost('left') },
            { label: '오른쪽 올림', colorIndex: 1, values: boost('right') },
          ]}
          yTitle="EQ (dB)"
          signed
        />
      </Suspense>
      <label className="ear-eq-strength">
        <span>보정 세기 {Math.round(strength * 100)}%</span>
        <input
          type="range"
          className="ear-balance-slider"
          min={0}
          max={1}
          step={0.1}
          value={strength}
          onChange={(e) => setStrength(Number(e.target.value))}
        />
      </label>
      {warnings.map((w) => (
        <p key={w} className="warning small">
          {w}
        </p>
      ))}
      {big && <p className="warning small">많이 덜 들리는 소리가 있어요. 이비인후과 진료를 권해요</p>}
      <Help>
        5dB까지는 측정 오차로 보고, 그보다 덜 들리는 만큼에 세기를 곱해 올려요(최대 +6dB, 깎지는 않아요). 세기 50%가 보통이에요.
        측정치로 기기 몫을 뺐다면, 측정치는 측정자마다 기준이 달라 원음을 해칠 수 있어요. 의료용 검사가 아니에요.
      </Help>
      <div className="ear-balance-actions">
        {onRetry && (
          <button type="button" onClick={onRetry}>
            다시 재기
          </button>
        )}
        <button type="button" className="primary" onClick={() => onSave({ ...profile, strength })}>
          {saveLabel ?? (isAndroidApp() ? '저장하고 적용' : '저장')}
        </button>
      </div>
    </div>
  )
}
