// 화면 아래쪽에 잠깐 떴다 사라지는 짧은 안내(토스트)를 여는 함수.
// 쓰는 법: showToast('한 번 더 누르면 앱을 닫아요', 2000)
// 그리는 것은 App에 하나 둔 <ToastHost />(components/ToastHost.tsx). 화면 밖(일반 함수)에서도 부를 수 있게
// 확인 팝업(confirm.ts)과 같은 방식으로 "보여주기 함수"를 여기에 등록해 둔다

let show: ((message: string, ms: number) => void) | null = null

export function setToastHandler(handler: ((message: string, ms: number) => void) | null): void {
  show = handler
}

export function showToast(message: string, ms = 2000): void {
  show?.(message, ms)
}
