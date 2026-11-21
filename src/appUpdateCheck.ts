// 앱 업데이트 확인 계산(순수 함수): GitHub Releases 정보에서 새 APK를 찾는다.
// 화면·네트워크·안드로이드 코드는 appUpdate.ts에 있다

/** GitHub API(releases/tags/…)가 돌려주는 것 중 쓰는 부분 */
export interface ReleaseInfo {
  assets: { name: string; browser_download_url: string }[]
}

export interface UpdateInfo {
  build: number
  url: string
  fileName: string
}

/** APK 파일 이름에서 빌드 번호. "audio-gear-0.1.35.apk" → 35, 형식이 다르면 null */
export function apkBuildNumber(name: string): number | null {
  const match = name.match(/^audio-gear-0\.1\.(\d+)\.apk$/)
  return match ? Number(match[1]) : null
}

/** 릴리스에서 지금 빌드보다 새로운 APK(여럿이면 가장 새것). 없으면 null */
export function findUpdate(release: ReleaseInfo, currentBuild: number): UpdateInfo | null {
  let best: UpdateInfo | null = null
  for (const asset of release.assets) {
    const build = apkBuildNumber(asset.name)
    if (build === null || build <= currentBuild) continue
    if (!best || build > best.build) best = { build, url: asset.browser_download_url, fileName: asset.name }
  }
  return best
}

/** 확인 간격(ms): 앱을 다시 앞으로 가져올 때마다 묻지 않게 */
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

/** 지금 확인할 때인지. force(앱을 새로 열 때·설정의 "업데이트 확인")면 늘 확인 */
export function shouldCheck(lastCheckAt: number | null, now: number, force: boolean): boolean {
  return force || lastCheckAt === null || now - lastCheckAt >= CHECK_INTERVAL_MS
}
