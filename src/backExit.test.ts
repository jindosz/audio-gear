// backExit.ts 테스트(뒤로 가기 두 번 눌러 나가기). 실행: npm test
import { describe, expect, it } from 'vitest'
import { EXIT_WINDOW_MS, backExitAction } from './backExit'

describe('backExitAction', () => {
  it('처음 누르면 안내만', () => {
    expect(backExitAction(null, 1000)).toBe('warn')
  })
  it('2초 안에 한 번 더 누르면 나간다', () => {
    expect(backExitAction(1000, 1000 + 500)).toBe('exit')
    expect(backExitAction(1000, 1000 + EXIT_WINDOW_MS)).toBe('exit')
  })
  it('2초가 지나서 누르면 다시 안내부터', () => {
    expect(backExitAction(1000, 1000 + EXIT_WINDOW_MS + 1)).toBe('warn')
  })
})
