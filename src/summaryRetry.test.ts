// summaryRetry.ts 테스트(측정치 미리 받기 다시 시도). 실행: npm test
import { describe, expect, it } from 'vitest'
import { RETRY_AFTER_MS, isPermanentFailure, retryDue } from './summaryRetry'

describe('isPermanentFailure', () => {
  it('404·410은 영구(파일 없음)', () => {
    expect(isPermanentFailure(new Error('측정치를 받지 못했습니다 (404)'))).toBe(true)
    expect(isPermanentFailure(new Error('측정치 파일이 없어요 (410)'))).toBe(true)
  })
  it('그 밖(네트워크·서버 오류)은 일시', () => {
    expect(isPermanentFailure(new Error('측정치를 받지 못했습니다 (503)'))).toBe(false)
    expect(isPermanentFailure(new TypeError('Failed to fetch'))).toBe(false)
    expect(isPermanentFailure('timeout')).toBe(false)
  })
})

describe('retryDue', () => {
  it('처음이면 바로, 30분 안이면 아직, 지나면 다시', () => {
    expect(retryDue(null, 0)).toBe(true)
    expect(retryDue(0, RETRY_AFTER_MS - 1)).toBe(false)
    expect(retryDue(0, RETRY_AFTER_MS)).toBe(true)
  })
})
