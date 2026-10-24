// 이 브라우저에만 남기는 화면 설정(목록 폭, 접은 구역 등)을 localStorage에 읽고 쓴다.
// localStorage는 사생활 보호 모드 등에서 막혀 있을 수 있어서 try/catch로 감싸고, 실패하면 기본값을 쓴다
export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writePref(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 저장하지 못해도 이번 사용에는 지장이 없다
  }
}
