// eqEngine.ts 테스트. 테스트(노드)는 일반 브라우저와 같은 "web" 플랫폼으로 보인다. 실행: npm test
import { describe, expect, it } from 'vitest'
import { getEqEngine } from './eqEngine'

describe('EQ 엔진 창구(웹)', () => {
  it('웹에서는 폰 전체 EQ가 없다', () => {
    expect(getEqEngine().kind).toBe('none')
  })

  it('웹의 상태는 늘 꺼짐', async () => {
    expect(await getEqEngine().status()).toEqual({ on: false })
  })
})
