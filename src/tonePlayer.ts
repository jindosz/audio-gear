// 내 귀 균형 시험 소리: 사인파를 0.4초 켜고 0.3초 끄기를 반복(끊어지는 소리가 위치를 잡기 쉬움).
// Web Audio API 연결: 사인파(OscillatorNode) → 켜고 끄기(GainNode) → 왼쪽·오른쪽 음량(GainNode 2개)
// → ChannelMergerNode(입력 0 = 왼쪽, 1 = 오른쪽) → 스피커.
// 균형은 큰 쪽만 줄인다(earBalance.ts의 channelAttenuation).
import { channelAttenuation } from './earBalance'

/** 소리 크기: −20dBFS(디지털 최대의 1/10). 폰 볼륨은 사용자가 평소 크기로 맞춘다 */
const LEVEL = 0.1
const ON_S = 0.4
const OFF_S = 0.3
const FADE_S = 0.03
/** 처음 무음(블루투스가 소리 앞부분을 자르지 않게) */
const LEAD_S = 0.3
/** 소리를 이만큼 앞까지 미리 예약해 둔다 */
const AHEAD_S = 1.5

export interface TonePlayer {
  start(freq: number, balanceDb: number): void
  setFreq(freq: number): void
  setBalance(db: number): void
  stop(): void
}

const dbToGain = (db: number) => Math.pow(10, db / 20)

export function createTonePlayer(): TonePlayer {
  let ctx: AudioContext | null = null
  let osc: OscillatorNode | null = null
  let left: GainNode | null = null
  let right: GainNode | null = null
  let timer: ReturnType<typeof setInterval> | null = null

  function applyBalance(db: number) {
    if (!ctx || !left || !right) return
    const att = channelAttenuation(db)
    // 슬라이더를 움직일 때 "틱" 소리가 나지 않게 아주 짧게 미끄러지듯 바꾼다
    left.gain.setTargetAtTime(dbToGain(att.left), ctx.currentTime, 0.02)
    right.gain.setTargetAtTime(dbToGain(att.right), ctx.currentTime, 0.02)
  }

  return {
    start(freq, balanceDb) {
      this.stop()
      ctx = new AudioContext()
      osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const env = ctx.createGain()
      env.gain.value = 0
      left = ctx.createGain()
      right = ctx.createGain()
      const merger = ctx.createChannelMerger(2)
      osc.connect(env)
      env.connect(left).connect(merger, 0, 0)
      env.connect(right).connect(merger, 0, 1)
      merger.connect(ctx.destination)
      const att = channelAttenuation(balanceDb)
      left.gain.value = dbToGain(att.left)
      right.gain.value = dbToGain(att.right)
      osc.start()

      // 켜고 끄기를 조금씩 미리 예약한다(타이머가 늦어도 소리는 정확한 박자로)
      const c = ctx
      let next = c.currentTime + LEAD_S
      const schedule = () => {
        while (next < c.currentTime + AHEAD_S) {
          env.gain.setValueAtTime(0, next)
          env.gain.linearRampToValueAtTime(LEVEL, next + FADE_S)
          env.gain.setValueAtTime(LEVEL, next + ON_S - FADE_S)
          env.gain.linearRampToValueAtTime(0, next + ON_S)
          next += ON_S + OFF_S
        }
      }
      schedule()
      timer = setInterval(schedule, 250)
    },
    setFreq(freq) {
      if (ctx && osc) osc.frequency.setValueAtTime(freq, ctx.currentTime)
    },
    setBalance: applyBalance,
    stop() {
      if (timer) clearInterval(timer)
      timer = null
      try {
        osc?.stop()
      } catch {
        // 이미 멈춤
      }
      void ctx?.close()
      ctx = osc = left = right = null
    },
  }
}

// ---- 내 귀 보정 시험(겨우 들리는 크기 재기): 한쪽 귀에 짧은 삐 소리 세 번 ----

const BEEP_S = 0.25
const BEEP_GAP_S = 0.15
const BEEP_FADE_S = 0.02
/** 소리 세 번이 끝나기까지 걸리는 시간(초) */
export const BEEPS_DURATION_S = BEEP_S * 3 + BEEP_GAP_S * 2

/**
 * ear 쪽 귀에만 freq 소리를 dbfs 크기로 세 번 낸다. 돌려주는 값 = 소리가 끝나는 시각(ctx.currentTime 기준, 초).
 * dbfs는 hearingTest.ts의 MAX_DB(−10) 이하만 들어온다(안전 장치로 여기서도 한 번 더 자름)
 */
export function playBeeps(ctx: AudioContext, ear: 'left' | 'right', freq: number, dbfs: number): number {
  const level = dbToGain(Math.min(-10, dbfs))
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = freq
  const env = ctx.createGain()
  env.gain.value = 0
  const merger = ctx.createChannelMerger(2)
  osc.connect(env).connect(merger, 0, ear === 'left' ? 0 : 1)
  merger.connect(ctx.destination)
  const start = ctx.currentTime + 0.05
  for (let i = 0; i < 3; i++) {
    const t = start + i * (BEEP_S + BEEP_GAP_S)
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(level, t + BEEP_FADE_S)
    env.gain.setValueAtTime(level, t + BEEP_S - BEEP_FADE_S)
    env.gain.linearRampToValueAtTime(0, t + BEEP_S)
  }
  const end = start + BEEPS_DURATION_S
  osc.start(start)
  osc.stop(end + 0.05)
  osc.onended = () => merger.disconnect()
  return end
}

/**
 * 시험용 소리 장치. 무음을 시험 내내 흘려 둔다: 블루투스는 소리가 없으면 잠들었다가 다음 소리 앞부분을 자르기 때문.
 * 처음 0.3초는 그 무음만 흘리고 시작한다. 끝나면 ctx.close()
 */
export async function openTestAudio(): Promise<AudioContext> {
  const ctx = new AudioContext()
  await ctx.resume()
  const silent = ctx.createConstantSource()
  const mute = ctx.createGain()
  mute.gain.value = 0
  silent.connect(mute).connect(ctx.destination)
  silent.start()
  await new Promise((r) => setTimeout(r, LEAD_S * 1000))
  return ctx
}
