// 안드로이드 앱 자동 업데이트 확인.
// 앱을 열 때·앞으로 다시 가져올 때·인터넷이 다시 연결될 때, GitHub Releases의 정식 빌드(android-latest)를 확인해서
// 지금보다 새 빌드가 있으면 "업데이트할까요?"를 묻고, 누르면 앱 안에서 APK를 받아 안드로이드 설치 화면을 띄운다.
// 파일로 설치한 앱은 몰래 설치할 수 없어서 설치 화면의 [설치]는 사용자가 한 번 누른다.
// 계산(새 빌드 찾기·확인 간격)은 appUpdateCheck.ts(순수 함수), 받기·설치는 AppUpdatePlugin.java
import { App } from '@capacitor/app'
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { findUpdate, shouldCheck, type ReleaseInfo, type UpdateInfo } from './appUpdateCheck'
import { currentBuildNumber } from './buildInfo'
import { askConfirm } from './confirm'
import { readPref, writePref } from './localPrefs'
import { isAndroidApp } from './platform'
import { showToast } from './toast'

/** 정식 빌드가 올라가는 릴리스(main 푸시 → .github/workflows/android.yml) */
const RELEASE_URL = 'https://api.github.com/repos/jindosz/audio-gear/releases/tags/android-latest'

// ---- 시험용: 미리 보기 빌드까지 업데이트(설정 → 고급, 나중에 지울 것. 이 묶음과 SettingsDialog의 PreviewUpdateRow) ----
/** 작업 브랜치 빌드가 올라가는 릴리스 */
const PREVIEW_RELEASE_URL = 'https://api.github.com/repos/jindosz/audio-gear/releases/tags/android-preview'
export const PREVIEW_UPDATES_KEY = 'update.preview'
export const previewUpdatesOn = () => readPref<boolean>(PREVIEW_UPDATES_KEY, false)
// ---- 시험용 끝 ----

/** 확인할 릴리스들의 파일을 한데 모은다(정식 + 켜져 있으면 미리 보기). 미리 보기를 못 받아도 정식만으로 */
async function fetchReleaseAssets(): Promise<ReleaseInfo> {
  const get = async (url: string) => {
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as ReleaseInfo
  }
  const stable = await get(RELEASE_URL)
  if (!previewUpdatesOn()) return stable
  const preview = await get(PREVIEW_RELEASE_URL).catch(() => ({ assets: [] }))
  return { assets: [...stable.assets, ...preview.assets] }
}
/** 마지막으로 확인한 시각(ms) */
const LAST_CHECK_KEY = 'update.lastCheck'

/** 네이티브 플러그인(AppUpdatePlugin.java와 맞춰야 한다) */
interface AppUpdatePlugin {
  canInstall(): Promise<{ allowed: boolean }>
  openInstallSettings(): Promise<void>
  downloadAndInstall(options: { url: string; fileName: string }): Promise<void>
  addListener(event: 'downloadProgress', listener: (e: { percent: number }) => void): Promise<PluginListenerHandle>
}

let plugin: AppUpdatePlugin | null = null
const getPlugin = () => (plugin ??= registerPlugin<AppUpdatePlugin>('AppUpdate'))

/** 확인·받기가 겹치지 않게 */
let busy = false
/** 이번에 앱을 연 동안 "나중에"를 누른 빌드(다시 묻지 않음, 앱을 새로 열면 다시 물음) */
let dismissedBuild: number | null = null
/** "설치 허용" 설정을 켜러 간 사이 기다리는 업데이트(앱으로 돌아오면 이어서 설치) */
let waitingForPermission: UpdateInfo | null = null

interface CheckOptions {
  /** 확인 간격(6시간)을 무시하고 확인 */
  force?: boolean
  /** 설정에서 직접 누름: 결과("최신 버전이에요" 등)를 알려 주고, "나중에" 누른 빌드도 다시 묻는다 */
  manual?: boolean
}

export async function checkForUpdate({ force = false, manual = false }: CheckOptions = {}): Promise<void> {
  if (!isAndroidApp()) return
  if (busy) {
    // 앱을 열 때 하는 자동 확인이 아직 도는 중: 눌렀는데 아무 반응이 없으면 안 되니 알려 준다
    if (manual) showToast('업데이트를 확인하는 중이에요')
    return
  }
  const current = currentBuildNumber()
  if (current === null) {
    if (manual) showToast('개발용 빌드라 업데이트를 확인하지 않아요')
    return
  }
  if (!navigator.onLine) {
    if (manual) showToast('인터넷에 연결되어 있지 않아요')
    return
  }
  if (!shouldCheck(readPref<number | null>(LAST_CHECK_KEY, null), Date.now(), force)) return

  busy = true
  try {
    const release = await fetchReleaseAssets()
    writePref(LAST_CHECK_KEY, Date.now())
    const update = findUpdate(release, current)
    if (!update) {
      if (manual) showToast('최신 버전이에요')
      return
    }
    if (!manual && dismissedBuild === update.build) return
    const ok = await askConfirm({
      title: '새 버전',
      message: `새 버전 0.1.${update.build}이 나왔어요(지금 0.1.${current}). 지금 업데이트할까요?`,
      ok: '업데이트',
    })
    if (!ok) {
      dismissedBuild = update.build
      return
    }
    await install(update)
  } catch {
    if (manual) showToast('업데이트를 확인하지 못했어요')
  } finally {
    busy = false
  }
}

/** 받아서 설치 화면 열기. 처음이면 "이 출처 허용" 설정부터 */
async function install(update: UpdateInfo): Promise<void> {
  const updater = getPlugin()
  const { allowed } = await updater.canInstall()
  if (!allowed) {
    const ok = await askConfirm({
      title: '설치 허용',
      message: '처음 한 번만 필요해요. 다음 화면에서 "이 출처 허용"을 켜고 앱으로 돌아오면 이어서 설치해요.',
      ok: '설정 열기',
    })
    if (ok) {
      waitingForPermission = update
      await updater.openInstallSettings()
    }
    return
  }
  showToast('새 버전 받는 중…', 4000)
  const handle = await updater.addListener('downloadProgress', ({ percent }) =>
    showToast(`새 버전 받는 중… ${percent}%`, 4000),
  )
  try {
    await updater.downloadAndInstall({ url: update.url, fileName: update.fileName })
  } catch (err) {
    showToast(err instanceof Error ? err.message : '업데이트를 받지 못했어요', 4000)
  } finally {
    void handle.remove()
  }
}

/**
 * 자동 확인 시작(App이 화면에 나온 뒤 한 번). 안드로이드 앱에서만.
 * - 앱을 열 때 바로 확인
 * - 앱을 다시 앞으로 가져올 때(6시간에 한 번까지), 설치 허용을 켜고 돌아왔으면 이어서 설치
 * - 인터넷이 끊겼다가 다시 연결되면 확인
 */
export function setupAutoUpdate(): () => void {
  if (!isAndroidApp()) return () => {}
  void checkForUpdate({ force: true })

  const onOnline = () => void checkForUpdate()
  window.addEventListener('online', onOnline)

  const resume = App.addListener('resume', () => {
    const pending = waitingForPermission
    waitingForPermission = null
    if (pending) void install(pending)
    else void checkForUpdate()
  })

  return () => {
    window.removeEventListener('online', onOnline)
    void resume.then((h) => h.remove())
  }
}
