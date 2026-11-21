// 빌드 정보: GitHub Actions가 빌드할 때 넣어 주는 번호와 커밋(VITE_ 로 시작하는 환경 변수는 Vite가 코드에 심어 준다).
// 내 PC의 개발 서버에서는 값이 없다
import { isAndroidApp } from './platform'

const buildNumber: string | undefined = import.meta.env.VITE_BUILD_NUMBER
const commit: string | undefined = import.meta.env.VITE_COMMIT

/** 설정 화면에 보여줄 버전 문구. 예: "안드로이드 앱 0.1.5 (빌드 5) · 커밋 2e6e48c" */
export function buildLabel(): string {
  if (!buildNumber) return '개발 중(빌드 번호 없음)'
  const kind = isAndroidApp() ? `안드로이드 앱 0.1.${buildNumber} (빌드 ${buildNumber})` : `웹 (빌드 ${buildNumber})`
  return commit ? `${kind} · 커밋 ${commit.slice(0, 7)}` : kind
}

/** 지금 앱의 빌드 번호(숫자). 개발 서버처럼 번호가 없으면 null */
export function currentBuildNumber(): number | null {
  const n = Number(buildNumber)
  return buildNumber && Number.isFinite(n) ? n : null
}
