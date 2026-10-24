// 기기 이름 정리. squig.link 목록은 리뷰어들이 손으로 만들어서 표기가 제각각이라,
// 목록에 보여주기 전에 모양을 맞추고 기기가 아닌 줄(구분선, 메모)은 걸러 낸다. 순수 함수.

/** 브랜드·모델 칸 앞에 붙은 표시(*, _, ~, #, -)와 앞뒤 공백을 지운다. 예) "_DIY" → "DIY", "*" → "" */
export function cleanPart(text: string): string {
  return text.replace(/^[\s*_~#-]+/, '').trim()
}

/** 괄호 짝 맞추기: 짝 없는 닫는 괄호는 지우고, 안 닫힌 여는 괄호는 끝에 닫아 준다 */
function balanceParens(text: string): string {
  let depth = 0
  let out = ''
  for (const ch of text) {
    if (ch === '(') depth++
    if (ch === ')') {
      if (depth === 0) continue
      depth--
    }
    out += ch
  }
  return out + ')'.repeat(depth)
}

/**
 * 목록에 보여줄 이름으로 정리한다. 기기가 아닌 줄이면 null.
 * - 기기가 아닌 줄: "EQ abuse:"처럼 콜론으로 끝나는 제목, 글자·숫자가 2개 미만("------- ---"), 괄호뿐인 이름("(CIEM - SA)")
 * - 전각 괄호 （）→ ( ), [설명] → (설명), "--" → " - ", 겹친 공백 → 한 칸
 * - 앞에 붙은 분류 괄호는 뒤로: "(Airline Ear Earbuds) Eva Air" → "Eva Air (Airline Ear Earbuds)", "<DIY> X" → "X (DIY)"
 * - 단어를 감싼 따옴표 떼기: "'V14'" → "V14"
 * - 괄호 짝 맞추기, 끝에 남은 _ : , ; 지우기
 */
export function cleanName(raw: string): string | null {
  let name = raw.replace(/\s+/g, ' ').trim()
  if (name.endsWith(':')) return null

  name = name
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\[([^\]]*)\]/g, '($1)')
    .replace(/\s*-{2,}\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()

  // 앞에 붙은 분류 표시 (…) 또는 <…>는 뒤로 보낸다. 예) "<DIY> BF DD" → "BF DD (DIY)"
  const lead = name.match(/^[(<]([^)>]*)[)>]\s*(.+)$/)
  if (lead) name = `${lead[2]} (${lead[1]})`
  // 단어 전체를 감싼 따옴표는 뗀다. 예) "'V14'" → "V14" (Richard's 같은 아포스트로피는 그대로)
  name = name.replace(/(^|\s)['"]([^'"]+)['"](?=\s|$)/g, '$1$2')

  name = balanceParens(name)
    .replace(/[\s_:,;]+$/, '')
    .trim()

  const alnum = name.replace(/[^\p{L}\p{N}]/gu, '')
  if (alnum.length < 2) return null
  if (/^\(.*\)$/.test(name)) return null
  return name
}
