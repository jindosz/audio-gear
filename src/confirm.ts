// 앱 모양의 확인 팝업을 여는 함수. 브라우저 기본 confirm()은 폰에서 하얗고 네모난 창으로 떠서 어색해서 대신 쓴다.
// 쓰는 법: if (!(await askConfirm({ message: '삭제할까요?', ok: '삭제', danger: true }))) return
// 팝업 자체는 App에 하나만 둔 <ConfirmHost />(components/ConfirmHost.tsx)가 그린다.
// askConfirm은 그 팝업을 열고, 사용자가 고를 때까지 기다렸다가 true(확인)/false(취소·닫기)를 돌려준다(Promise)

export interface ConfirmOptions {
  /** 팝업 제목(짧게). 없으면 "확인" */
  title?: string
  message: string
  /** 확인 버튼 글자. 없으면 "확인" */
  ok?: string
  /** 지우기처럼 되돌릴 수 없는 일이면 확인 버튼을 빨갛게 */
  danger?: boolean
}

export interface ConfirmRequest extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

// 화면 밖(일반 함수)에서 팝업을 열 수 있게, 지금 화면에 있는 ConfirmHost의 "열기 함수"를 여기에 둔다
let show: ((req: ConfirmRequest) => void) | null = null

/** ConfirmHost가 화면에 나타날 때 열기 함수를 등록하고, 사라질 때 null로 지운다 */
export function setConfirmHandler(handler: ((req: ConfirmRequest) => void) | null): void {
  show = handler
}

export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (show) show({ ...options, resolve })
    else resolve(window.confirm(options.message)) // 혹시 팝업 자리가 없으면 예전 방식으로
  })
}
