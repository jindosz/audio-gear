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

export function EarEqDialog({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'ready' })
  const [deviceChoice, setDeviceChoice] = useState('')
  const [flash, setFlash] = useState(false)
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
  const options = (measurements ?? [])
    .flatMap((m) => {
      const d = deviceById.get(m.deviceId)
      return d ? [{ m, d, label: `${d.brand} ${d.model} · ${sourceLabel(m.source)}` }] : []
    })
    .sort((a, b) => Number(b.d.owned) - Number(a.d.owned) || a.label.localeCompare(b.label))

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
      let s = newStaircase()
      while (s.threshold === null) {
        await wait(gapMs(Math.random), token)
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
            <p className="warning small">측정치는 측정자마다 기준이 달라 원음을 해칠 수 있어요</p>
            <Help>
              조용한 곳에서 하고, 폰 볼륨은 평소 듣는 크기로 두고 시험 중엔 바꾸지 마세요. 무선 이어폰은 아주 작은 소리를 꺼 버릴 수 있어
              유선이 더 정확해요. 이어폰 앱의 효과·노이즈 캔슬링·주변 소리 듣기와 삼성 사운드 효과는 꺼 주세요. 기기를 고르면 그 측정치가
              타깃과 다른 만큼(기기 몫)을 빼는데, 측정치는 측정자·장비마다 기준이 달라 몇 dB씩 차이가 나서 원음을 해칠 수 있어요. 잘
              모르겠으면 "모름"을 골라요(그럼 결과가 그 기기 전용이 돼요). 의료용 검사가 아니에요.
            </Help>
            <div className="ear-balance-actions">
              <button type="button" className="primary" onClick={() => void begin()}>
                시작
              </button>
            </div>
          </>
        )}

        {step.kind === 'test' && (
          <>
            <p className="ear-balance-progress">
              {step.ear === 'left' ? '왼쪽' : '오른쪽'} 귀 · {step.index + 1} / {ORDER.length}
            </p>
            <p className="muted small">아주 작은 소리도 들리면 바로 눌러요</p>
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
