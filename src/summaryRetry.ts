// 측정치 미리 받기의 "실패한 것 다시 시도" 판단(순수 함수).
// - 영구 실패: 서버가 "파일이 없다"(404·410)고 답한 것. 다시 받아도 소용없어서 "받을 수 없음"으로 따로 둔다
// - 일시 실패: 네트워크 끊김·서버 오류 등. 나중에(RETRY_AFTER_MS 뒤) 앱을 열거나 인터넷이 다시 연결되면 그것만 다시 받는다

/** 실패한 것을 다시 시도하기까지 기다리는 시간 */
export const RETRY_AFTER_MS = 30 * 60 * 1000

/** 오류 문구에 "(404)"·"(410)"이 있으면 영구 실패(catalog.ts의 fetchCatalogCurve가 상태 코드를 괄호로 붙인다) */
export function isPermanentFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /\((404|410)\)/.test(message)
}

/** 다시 시도할 때가 됐는지. lastTryAt: 마지막으로 시도한 시각(없으면 바로) */
export function retryDue(lastTryAt: number | null, now: number): boolean {
  return lastTryAt === null || now - lastTryAt >= RETRY_AFTER_MS
}
