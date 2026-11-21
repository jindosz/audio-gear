// 안드로이드 앱: 폰의 뒤로 가기 버튼·제스처 처리.
// 기본 동작은 앱을 닫아 버려서, 팝업이 열려 있으면 팝업만 닫고, 아무것도 없으면
// 처음엔 "한 번 더 누르면 앱을 닫아요" 안내만 띄우고(실수로 나가지 않게), 2초 안에 한 번 더 누르면 앱을 뒤로 보낸다
// (폰 전체 EQ 서비스는 앱을 닫아도 돌지만, 앱을 다시 열 때 처음부터 불러오지 않아도 되게).
import { App } from '@capacitor/app'
import { backExitAction, EXIT_WINDOW_MS } from './backExit'
import { isAndroidApp } from './platform'
import { showToast } from './toast'

/** 화면에 열려 있는 <dialog> 중 맨 위(가장 나중에 열린 것) */
function topDialog(): HTMLDialogElement | null {
  const open = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
  return open.length ? open[open.length - 1] : null
}

export function setupBackButton(): void {
  if (!isAndroidApp()) return
  // 팝업 없이 뒤로 가기를 마지막으로 누른 시각
  let lastPressAt: number | null = null
  void App.addListener('backButton', () => {
    const dialog = topDialog()
    if (!dialog) {
      const now = Date.now()
      if (backExitAction(lastPressAt, now) === 'exit') {
        lastPressAt = null
        void App.minimizeApp()
      } else {
        lastPressAt = now
        showToast('한 번 더 누르면 앱을 닫아요', EXIT_WINDOW_MS)
      }
      return
    }
    // Esc 키와 같은 "cancel" 신호를 보낸다. Modal이 받아서 사라지는 애니메이션 뒤에 닫는다.
    // 받아 주는 곳이 없으면(preventDefault 안 됨) 바로 닫는다
    const cancel = new Event('cancel', { cancelable: true })
    if (dialog.dispatchEvent(cancel)) dialog.close()
  })
}
