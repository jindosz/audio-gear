// 글자 처리 도우미

/** 검색어·이름 비교용: 소문자로 바꾸고 공백·기호를 지운다 ("HD600"과 "HD 600"이 같게 됨) */
export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}
