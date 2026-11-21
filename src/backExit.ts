// 뒤로 가기로 앱을 나갈 때 "한 번 더 누르면 닫혀요"를 거치게 하는 판단(순수 함수).
// 처음 누르면 안내만 띄우고, 안내가 떠 있는 동안(EXIT_WINDOW_MS 안에) 한 번 더 누르면 나간다

/** 두 번째 누름을 기다리는 시간(ms). 안내가 떠 있는 시간과 같다 */
export const EXIT_WINDOW_MS = 2000

/**
 * lastPressAt: 바로 전에 (팝업이 없을 때) 뒤로 가기를 누른 시각(ms). 없으면 null
 * now: 지금 시각(ms)
 * 'exit' = 앱을 나감, 'warn' = 안내만 띄우고 시각을 기억
 */
export function backExitAction(lastPressAt: number | null, now: number): 'exit' | 'warn' {
  return lastPressAt !== null && now - lastPressAt <= EXIT_WINDOW_MS ? 'exit' : 'warn'
}
