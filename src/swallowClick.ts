// 손가락을 끈 직후 따라오는 클릭 한 번을 버린다(끌기가 끝난 자리의 버튼·기기 줄이 눌리지 않게).
// 목록 시트 손잡이(ListGrip)와 비교 탭 밀어 넘기기(useSwipeTabs)가 함께 쓴다
export function swallowNextClick(): void {
  const stop = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
  }
  window.addEventListener('click', stop, { capture: true, once: true })
  // 클릭이 오지 않는 경우(끌다가 화면 밖에서 뗌 등)를 위해 잠시 뒤 지운다
  setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 400)
}
