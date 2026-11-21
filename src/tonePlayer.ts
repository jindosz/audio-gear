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
