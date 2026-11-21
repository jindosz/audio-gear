// 내 귀 보정 측정 팝업: 준비(기기 고르기) → 왼쪽·오른쪽 귀 시험(삐 소리가 들리면 [들려요]) → 결과(EarEqResult).
// 시험 중에는 폰에 걸린 EQ를 잠깐 끄고(setBypass), 끝나거나 닫으면 되돌린다. 중간에 닫으면 처음부터.
// 계단법은 hearingTest.ts, 보정 계산은 earEq.ts, 소리는 tonePlayer.ts
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { deviceOffset, type EarProfile } from '../earEq'
import { saveEarProfile } from '../earEqStore'
import { getEqEngine } from '../eqEngine'
import {
  gapMs,
  HEARING_FREQS,
  isCatchTrial,
  newStaircase,
  RECHECK_FREQ,
  respond,
  type EarResult,
} from '../hearingTest'
import { sourceLabel } from '../labels'
import { isAndroidApp } from '../platform'
import { listDevices, listMeasurements } from '../repo'
import { prepare, SUMMARY_GRID } from '../similarity'
import { tagReferenceId } from '../soundTags'
import { ensureTarget } from '../targets'
import { showToast } from '../toast'
import { BEEPS_DURATION_S, openTestAudio, playBeeps } from '../tonePlayer'
import { EarEqResult } from './EarEqResult'
import { Help } from './Help'
import { Modal } from './Modal'
import { Select } from './Select'

interface Props {
  open: boolean
  onClose: () => void
}

type Ear = 'left' | 'right'
/** 한 귀에서 재는 순서: 7개 + 끝에 1kHz 한 번 더 */
const ORDER = [...HEARING_FREQS, RECHECK_FREQ]
/** 소리가 끝난 뒤 이만큼 안에 누르면 "들림" */
const RESPONSE_MS = 2500

type Step =
  | { kind: 'ready' }
  | { kind: 'test'; ear: Ear; index: number }
  | { kind: 'result'; profile: EarProfile; firstAt1k: { left: number | null; right: number | null } }

class Cancelled extends Error {}

const freqLabel = (hz: number) => (hz >= 1000 ? `${hz / 1000}kHz` : `${hz}Hz`)
/** 한 주파수에 보통 이만큼 들려줘서, 진행 막대가 그 안에서도 조금씩 차게 한다 */
const TYPICAL_TRIALS = 8

/**
 * 진행 표시: 전체 막대(양쪽 귀 16단계)와 지금 주파수·몇 번째 소리, 늘 깜빡이는 "듣는 중".
 * 소리가 나는 순간은 일부러 보여 주지 않는다(화면을 보고 누르면 검사가 안 됨)
 */
function TestProgress({ ear, index, trial }: { ear: Ear; index: number; trial: number }) {
  const total = ORDER.length * 2
  const done = (ear === 'right' ? ORDER.length : 0) + index + Math.min(trial / TYPICAL_TRIALS, 0.9)
  const percent = Math.round((done / total) * 100)
  return (
    <div className="ear-eq-progress">
      <div className="ear-eq-progress-head">
        <span className="ear-balance-progress">
          {ear === 'left' ? '왼쪽' : '오른쪽'} 귀 · {freqLabel(ORDER[index])}
        </span>
        <span className="muted small">{percent}%</span>
      </div>
      <div className="ear-eq-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
        <div style={{ width: `${percent}%` }} />
      </div>
      <p className="muted small ear-eq-listening">
        <i /> 듣는 중 · {index + 1}/{ORDER.length}단계 · {Math.max(trial, 1)}번째 소리
      </p>
    </div>
  )
}

export function EarEqDialog({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'ready' })
  const [deviceChoice, setDeviceChoice] = useState('')
  const [flash, setFlash] = useState(false)
  // 지금 주파수에서 몇 번째 소리인지(가짜 문항 포함, 진행 표시용)
  const [trial, setTrial] = useState(0)
  const [checking, setChecking] = useState(false)
  const devices = useLiveQuery(listDevices)
  const measurements = useLiveQuery(listMeasurements)
  // 시험을 멈출 표시, 지금 응답을 기다리는 함수, 소리 장치
  const run = useRef<{ cancelled: boolean } | null>(null)
  const pressed = useRef<(() => void) | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const bypassed = useRef(false)

  function stopTest() {
    if (run.current) run.current.cancelled = true
    run.current = null
    pressed.current = null
    void ctxRef.current?.close()
    ctxRef.current = null
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

  // PC: 스페이스바로도 "들려요"
  useEffect(() => {
    if (step.kind !== 'test') return
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      hear()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step.kind])

  function hear() {
    setFlash(true)
    setTimeout(() => setFlash(false), 150)
    pressed.current?.()
  }

  const deviceById = new Map((devices ?? []).map((d) => [d.id, d]))
  // 보유 기기 측정치만(목록에서 눌러 본 기기도 DB에 저장되지만, 시험에 쓰는 건 내가 가진 기기)
  const options = (measurements ?? [])
    .flatMap((m) => {
      const d = deviceById.get(m.deviceId)
      return d?.owned ? [{ m, d, label: `${d.brand} ${d.model} · ${sourceLabel(m.source)}` }] : []
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  async function begin() {
    stopTest()
    const token = { cancelled: false }
    run.current = token
    setStep({ kind: 'test', ear: 'left', index: 0 })
    bypassed.current = true
    void getEqEngine().setBypass(true)
    try {
      const ctx = await openTestAudio()
      if (token.cancelled) {
        void ctx.close()
        return
      }
      ctxRef.current = ctx
      const left = await testEar(ctx, 'left', token)
      const right = await testEar(ctx, 'right', token)
      stopTest()
      const profile: EarProfile = {
        measuredAt: new Date().toISOString(),
        device: null,
        left: left.result,
        right: right.result,
        offset: null,
        strength: 0.5,
        on: true,
      }
      await addDeviceOffset(profile)
      setStep({ kind: 'result', profile, firstAt1k: { left: left.first1k, right: right.first1k } })
    } catch (err) {
      if (!(err instanceof Cancelled)) {
        stopTest()
        showToast('시험을 시작하지 못했어요')
        setStep({ kind: 'ready' })
      }
    }
  }

  /** 기기를 골랐으면 그 측정치가 타깃보다 큰 만큼(기기 몫)을 계산해 넣는다. 타깃을 못 받으면 빼지 않음 */
  async function addDeviceOffset(profile: EarProfile) {
    const picked = options.find((o) => o.m.id === deviceChoice)
    if (!picked) return
    profile.device = { label: `${picked.d.brand} ${picked.d.model}`, measurementId: picked.m.id, source: picked.m.source }
    try {
      const target = await ensureTarget(tagReferenceId(picked.d.category, picked.m.rig))
      profile.offset = deviceOffset(
        prepare(picked.m.curve, SUMMARY_GRID, 1),
        prepare(target.curve, SUMMARY_GRID, 1),
        SUMMARY_GRID,
        profile.left.freqs,
      )
    } catch {
      showToast('타깃을 받지 못해 기기 몫은 빼지 않았어요')
    }
  }

  async function testEar(ctx: AudioContext, ear: Ear, token: { cancelled: boolean }) {
    const thresholds = new Map<number, { value: number | null; atLimit: boolean }>()
    let first1k: number | null = null
    let recheck: number | null = null
    let falseAlarms = 0
    for (let index = 0; index < ORDER.length; index++) {
      const freq = ORDER[index]
      setStep({ kind: 'test', ear, index })
      setTrial(0)
      let s = newStaircase()
      while (s.threshold === null) {
        await wait(gapMs(Math.random), token)
        setTrial((n) => n + 1)
        const fake = isCatchTrial(Math.random)
        const end = fake ? ctx.currentTime + BEEPS_DURATION_S : playBeeps(ctx, ear, freq, s.level)
        const heard = await waitForPress((end - ctx.currentTime) * 1000 + RESPONSE_MS, token)
        if (fake) {
          if (heard) falseAlarms++
          continue
        }
        s = respond(s, heard)
      }
      if (index === ORDER.length - 1) recheck = s.threshold
      else {
        thresholds.set(freq, { value: s.threshold, atLimit: s.atLimit })
        if (freq === RECHECK_FREQ) first1k = s.threshold
      }
    }
    const freqs = [...HEARING_FREQS].sort((a, b) => a - b)
    const result: EarResult = {
      freqs,
      thresholds: freqs.map((f) => thresholds.get(f)?.value ?? null),
      atLimit: freqs.map((f) => thresholds.get(f)?.atLimit ?? false),
      recheck,
      falseAlarms,
    }
    return { result, first1k }
  }

  function wait(ms: number, token: { cancelled: boolean }) {
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => (token.cancelled ? reject(new Cancelled()) : resolve()), ms)
    })
  }

  /** ms 안에 [들려요]를 누르면 true */
  function waitForPress(ms: number, token: { cancelled: boolean }) {
    return new Promise<boolean>((resolve, reject) => {
      const timer = setTimeout(() => {
        pressed.current = null
        if (token.cancelled) reject(new Cancelled())
        else resolve(false)
      }, ms)
      pressed.current = () => {
        clearTimeout(timer)
        pressed.current = null
        if (token.cancelled) reject(new Cancelled())
        else resolve(true)
      }
    })
  }

  /** [소리 확인]: 잘 들리는 크기(−20dBFS)로 왼쪽 → 오른쪽 한 번씩. 볼륨·연결을 시험 전에 확인 */
  async function soundCheck() {
    if (checking) return
    setChecking(true)
    try {
      const ctx = await openTestAudio()
      const end = playBeeps(ctx, 'left', 1000, -20)
      await new Promise((r) => setTimeout(r, (end - ctx.currentTime) * 1000 + 400))
      const end2 = playBeeps(ctx, 'right', 1000, -20)
      await new Promise((r) => setTimeout(r, (end2 - ctx.currentTime) * 1000 + 200))
      void ctx.close()
    } catch {
      showToast('소리를 내지 못했어요')
    } finally {
      setChecking(false)
    }
  }

  async function save(p: EarProfile) {
    await saveEarProfile(p)
    showToast(isAndroidApp() ? '저장하고 폰에 적용했어요' : '저장했어요')
    close()
  }

  function close() {
    stopTest()
    setStep({ kind: 'ready' })
    onClose()
  }

  return (
    <Modal open={open} onClose={close} title="내 귀 보정">
      <div className="ear-balance">
        {step.kind === 'ready' && (
          <>
            <p>양쪽 귀에 작은 삐 소리를 들려줘요. 들리면 [들려요]를 눌러요. 5~8분 걸려요.</p>
            <label className="ear-eq-device">
              <span className="muted small">지금 쓰는 기기</span>
              <Select value={deviceChoice} onChange={(e) => setDeviceChoice(e.target.value)}>
                <option value="">모름(기기 몫 빼지 않음)</option>
                {options.map((o) => (
                  <option key={o.m.id} value={o.m.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
            {measurements && options.length === 0 && (
              <p className="muted small">보유 기기가 없어요. 기기 목록에서 보유로 표시하면 고를 수 있어요</p>
            )}
            <p className="warning small">측정치는 측정자마다 기준이 달라 원음을 해칠 수 있어요</p>
            <Help>
              조용한 곳에서 하고, 폰 볼륨은 평소 듣는 크기로 두고 시험 중엔 바꾸지 마세요. 무선 이어폰은 아주 작은 소리를 꺼 버릴 수 있어
              유선이 더 정확해요. 이어폰 앱의 효과·노이즈 캔슬링·주변 소리 듣기와 삼성 사운드 효과는 꺼 주세요. 기기를 고르면 그 측정치가
              타깃과 다른 만큼(기기 몫)을 빼는데, 측정치는 측정자·장비마다 기준이 달라 몇 dB씩 차이가 나서 원음을 해칠 수 있어요. 잘
              모르겠으면 "모름"을 골라요(그럼 결과가 그 기기 전용이 돼요). 의료용 검사가 아니에요.
            </Help>
            <div className="ear-balance-actions">
              <button type="button" onClick={() => void soundCheck()} disabled={checking}>
                {checking ? '왼쪽 → 오른쪽…' : '소리 확인'}
              </button>
              <button type="button" className="primary" onClick={() => void begin()}>
                시작
              </button>
            </div>
          </>
        )}

        {step.kind === 'test' && (
          <>
            <TestProgress ear={step.ear} index={step.index} trial={trial} />
            <p className="muted small">아주 작은 소리도 들리면 바로 눌러요. 안 들리면 그대로 기다려요(소리가 점점 커져요)</p>
            <button
              type="button"
              className={`ear-eq-hear primary${flash ? ' flash' : ''}`}
              onPointerDown={(e) => {
                e.preventDefault()
                hear()
              }}
            >
              들려요
            </button>
          </>
        )}

        {step.kind === 'result' && (
          <EarEqResult profile={step.profile} firstAt1k={step.firstAt1k} onSave={(p) => void save(p)} onRetry={() => void begin()} />
        )}
      </div>
    </Modal>
  )
}
