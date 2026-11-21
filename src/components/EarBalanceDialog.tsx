// 내 귀 균형 측정 팝업: 준비 → 6번 "가운데로 들리게" 맞추기 → 결과(저장하고 적용).
// 시험 중에는 폰에 걸린 EQ·균형을 잠깐 끄고(setBypass), 끝나거나 닫으면 원래대로 되돌린다.
// 계산은 earBalance.ts, 소리는 tonePlayer.ts, 저장·적용은 earBalanceStore.ts
import { useEffect, useRef, useState } from 'react'
import {
  BALANCE_FREQS,
  BALANCE_MAX,
  BALANCE_MIN,
  BALANCE_STEP,
  balanceLabel,
  randomStart,
  summarize,
  type BalanceResult,
} from '../earBalance'
import { saveEarBalance } from '../earBalanceStore'
import { getEqEngine } from '../eqEngine'
import { isAndroidApp } from '../platform'
import { showToast } from '../toast'
import { createTonePlayer, type TonePlayer } from '../tonePlayer'
import { Help } from './Help'
import { Modal } from './Modal'

interface Props {
  open: boolean
  onClose: () => void
}

type Step = { kind: 'ready' } | { kind: 'test'; index: number } | { kind: 'result'; result: BalanceResult }

const freqLabel = (hz: number) => (hz >= 1000 ? `${hz / 1000}kHz` : `${hz}Hz`)

export function EarBalanceDialog({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'ready' })
  const [value, setValue] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const player = useRef<TonePlayer | null>(null)
  const bypassed = useRef(false)

  /** 소리를 멈추고 잠깐 끈 EQ를 되돌린다(여러 번 불러도 됨) */
  function stopTest() {
    player.current?.stop()
    player.current = null
    if (bypassed.current) {
      bypassed.current = false
      void getEqEngine().setBypass(false)
    }
  }

  // 팝업이 닫히거나(뒤로 가기 포함) 화면에서 사라지면 반드시 멈춤
  useEffect(() => {
    if (!open) stopTest()
    return stopTest
  }, [open])

  function begin() {
    const start = randomStart(Math.random)
    setAnswers([])
    setValue(start)
    setStep({ kind: 'test', index: 0 })
    bypassed.current = true
    void getEqEngine().setBypass(true)
    player.current = createTonePlayer()
    player.current.start(BALANCE_FREQS[0], start)
  }

  function next(index: number) {
    const all = [...answers, value]
    setAnswers(all)
    if (index + 1 >= BALANCE_FREQS.length) {
      stopTest()
      setStep({ kind: 'result', result: summarize(all) })
      return
    }
    const start = randomStart(Math.random)
    setValue(start)
    setStep({ kind: 'test', index: index + 1 })
    player.current?.setFreq(BALANCE_FREQS[index + 1])
    player.current?.setBalance(start)
  }

  function move(v: number) {
    setValue(v)
    player.current?.setBalance(v)
  }

  async function save(db: number) {
    await saveEarBalance(db)
    showToast(isAndroidApp() ? '저장하고 폰에 적용했어요' : '저장했어요')
    close()
  }

  function close() {
    stopTest()
    setStep({ kind: 'ready' })
    onClose()
  }

  return (
    <Modal open={open} onClose={close} title="내 귀 균형">
      <div className="ear-balance">
        {step.kind === 'ready' && (
          <>
            <p>삐 소리가 머리 한가운데서 들리도록 슬라이더를 맞춰요. 6번, 1분쯤 걸려요.</p>
            <p className="muted small">시작 전에 이어폰을 끼고 폰 볼륨을 평소 듣는 크기로 맞춰 주세요.</p>
            <Help>
              의료용 검사가 아니에요. 조용한 곳에서 하고, 시험 중에는 볼륨 버튼을 누르지 마세요. 삼성 사운드 효과(Dolby Atmos·이퀄라이저)와
              이어폰 앱의 적응형 EQ·주변 소리 듣기는 꺼 주세요. 폰에 걸어 둔 EQ는 시험하는 동안 잠깐 꺼져요. 결과만큼 더 크게 들리는 쪽을
              줄여서 맞춰요(소리를 키우지는 않아요).
            </Help>
            <div className="ear-balance-actions">
              <button type="button" className="primary" onClick={begin}>
                시작
              </button>
            </div>
          </>
        )}

        {step.kind === 'test' && (
          <>
            <p className="ear-balance-progress">
              {step.index + 1} / {BALANCE_FREQS.length} · {freqLabel(BALANCE_FREQS[step.index])}
            </p>
            <p className="muted small">소리가 가운데서 들리게 맞춰요</p>
            <input
              type="range"
              className="ear-balance-slider"
              min={BALANCE_MIN}
              max={BALANCE_MAX}
              step={BALANCE_STEP}
              value={value}
              onChange={(e) => move(Number(e.target.value))}
              aria-label="좌우 균형"
            />
            <div className="ear-balance-ends muted small">
              <span>왼쪽</span>
              <span>가운데</span>
              <span>오른쪽</span>
            </div>
            <div className="ear-balance-actions">
              <button type="button" className="primary" onClick={() => next(step.index)}>
                {step.index + 1 >= BALANCE_FREQS.length ? '끝' : '다음'}
              </button>
            </div>
          </>
        )}

        {step.kind === 'result' && (
          <>
            <p className="ear-balance-result">{balanceLabel(step.result.db)}</p>
            {step.result.unstable && <p className="warning small">값이 들쭉날쭉해요. 다시 재 보면 더 정확해요</p>}
            {step.result.seeDoctor && <p className="warning small">좌우 차이가 커요. 이비인후과 진료를 권해요</p>}
            <div className="ear-balance-actions">
              <button type="button" onClick={begin}>
                다시 재기
              </button>
              <button type="button" className="primary" onClick={() => void save(step.result.db)}>
                {isAndroidApp() ? '저장하고 적용' : '저장'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
