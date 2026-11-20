// 안드로이드 앱: 폰의 뒤로 가기 버튼·제스처 처리.
// 기본 동작은 앱을 닫아 버려서, 팝업이 열려 있으면 팝업만 닫고, 아무것도 없으면 앱을 닫지 않고 뒤로 보낸다
// (폰 전체 EQ 서비스는 앱을 닫아도 돌지만, 앱을 다시 열 때 처음부터 불러오지 않아도 되게).
import { App } from '@capacitor/app'
import { isAndroidApp } from './platform'

/** 화면에 열려 있는 <dialog> 중 맨 위(가장 나중에 열린 것) */
function topDialog(): HTMLDialogElement | null {
  const open = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
  return open.length ? open[open.length - 1] : null
}

export function setupBackButton(): void {
  if (!isAndroidApp()) return
  void App.addListener('backButton', () => {
    const dialog = topDialog()
    // close()를 부르면 Modal의 onClose가 불려 화면 상태도 "닫힘"이 된다
    if (dialog) dialog.close()
    else void App.minimizeApp()
  })
}
