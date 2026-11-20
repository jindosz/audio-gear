// 플랫폼(일반 브라우저 / 안드로이드 앱)마다 다르게 해야 하는 일을 모아 두는 창구.
// 화면 코드는 여기 함수만 부르고, 플랫폼을 직접 확인하지 않는다(나중에 Windows 앱을 붙일 때도 여기만 고치면 되게).
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/** 안드로이드 앱(Capacitor) 안에서 열렸는지. 일반 브라우저·PWA면 false */
export function isAndroidApp(): boolean {
  return Capacitor.getPlatform() === 'android'
}

/** saveTextFile의 결과. 'cancelled'는 사용자가 공유 창을 그냥 닫은 경우 */
export type SaveResult = 'saved' | 'cancelled'

/**
 * 글로 된 파일을 사용자에게 건넨다.
 * - 브라우저: 파일 내려받기
 * - 안드로이드 앱: 앱 안(WebView)에서는 내려받기가 안 되므로, 앱 임시 폴더에 쓴 뒤 공유 창을 연다.
 *   사용자가 공유 창에서 "내 파일"·드라이브·다른 앱 등 보낼 곳을 고른다
 */
export async function saveTextFile(fileName: string, text: string, mime: string): Promise<SaveResult> {
  if (!isAndroidApp()) {
    // Blob: 메모리에 만든 파일. 임시 주소(URL)를 만들어 <a download>로 내려받게 한 뒤 주소를 지운다
    const blob = new Blob([text], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
    return 'saved'
  }
  const { uri } = await Filesystem.writeFile({
    path: fileName,
    data: text,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  })
  try {
    await Share.share({ title: fileName, files: [uri] })
    return 'saved'
  } catch (e) {
    // 사용자가 공유 창을 그냥 닫은 것은 오류가 아니지만, 저장된 것도 아니다
    if (e instanceof Error && /cancel/i.test(e.message)) return 'cancelled'
    throw e
  }
}
