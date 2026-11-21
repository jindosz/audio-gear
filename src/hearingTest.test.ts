// hearingTest.ts 테스트(내 귀 보정: 계단법). 실행: npm test
import { describe, expect, it } from 'vitest'
import { earWarnings, gapMs, isCatchTrial, MAX_DB, MIN_DB, newStaircase, respond, START_DB, type Staircase } from './hearingTest'

const run = (answers: boolean[], s: Staircase = newStaircase()) => answers.reduce((acc, a) => respond(acc, a), s)

describe('계단법', () => {
  it('처음은 −40dBFS, 들리면 10 내리고 안 들리면 5 올림', () => {
    expect(newStaircase().level).toBe(START_DB)
    expect(run([true]).level).toBe(-50)
    expect(run([true, false]).level).toBe(-45)
  })
  it('올라가는 단계에서 같은 크기를 두 번 들으면 역치', () => {
    // −40 들림, −50 안 들림, −45 들림(올라감 1), −55 안 들림, −50 안 들림, −45 들림(올라감 2)
    const s = run([true, false, true, false, false, true])
    expect(s.threshold).toBe(-45)
    expect(s.atLimit).toBe(false)
  })
  it('내려가다 들은 것은 세지 않음', () => {
    const s = run([true, true, true])
    expect(s.threshold).toBeNull()
  })
  it('최대 크기(−10)에서도 두 번 안 들리면 못 잼으로 끝', () => {
    const s = run(Array(12).fill(false))
    expect(s.level).toBeLessThanOrEqual(MAX_DB)
    expect(s.threshold).toBe(MAX_DB)
    expect(s.atLimit).toBe(true)
  })
  it('절대 −10보다 크게 내지 않음', () => {
    let s = newStaircase()
    for (let i = 0; i < 20 && s.threshold === null; i++) {
      s = respond(s, false)
      expect(s.level).toBeLessThanOrEqual(MAX_DB)
    }
  })
  it('계속 들려도 −100 아래로는 안 내려감', () => {
    let s = newStaircase()
    for (let i = 0; i < 10; i++) s = respond(s, true)
    expect(s.level).toBeGreaterThanOrEqual(MIN_DB)
  })
  it('20번이 넘으면 반드시 끝남', () => {
    // 들림·안 들림을 번갈아 하면 올라가는 단계에서 같은 크기를 두 번 못 맞출 수 있음
    let s = newStaircase()
    const pattern = [true, false, false, true, false, false, false, true]
    for (let i = 0; i < 20 && s.threshold === null; i++) s = respond(s, pattern[i % pattern.length])
    expect(s.threshold).not.toBeNull()
  })
})

describe('가짜 문항·간격', () => {
  it('가짜 문항 15%', () => {
    expect(isCatchTrial(() => 0.1)).toBe(true)
    expect(isCatchTrial(() => 0.2)).toBe(false)
  })
  it('간격 1~2.5초', () => {
    expect(gapMs(() => 0)).toBe(1000)
    expect(gapMs(() => 0.999)).toBeLessThanOrEqual(2500)
  })
})

describe('earWarnings', () => {
  const base = { freqs: [1000], thresholds: [-50], atLimit: [false], recheck: -50, falseAlarms: 0 }
  it('가짜 문항에서 3번 넘게 누르면', () => {
    expect(earWarnings({ ...base, falseAlarms: 4 }, -50).falseAlarms).toBe(true)
    expect(earWarnings({ ...base, falseAlarms: 3 }, -50).falseAlarms).toBe(false)
  })
  it('1kHz 두 값이 10dB 넘게 다르면', () => {
    expect(earWarnings({ ...base, recheck: -61 }, -50).unstable).toBe(true)
    expect(earWarnings({ ...base, recheck: -60 }, -50).unstable).toBe(false)
  })
})
