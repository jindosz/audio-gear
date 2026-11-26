// EQ로 들어보기의 "같은 측정자로 맞추기": 두 기기를 같은 측정자가 잰 측정치로 맞출 측정자를 고른다(순수 함수).
// 측정자·리그가 다르면 같은 기기도 2dB 넘게 달라서, EQ에 측정 환경 차이까지 섞인다(CLAUDE.md 추천 기능 설계 참고)
// 순서: 이미 저장된 측정치로 바로 되는 측정자 → 한쪽만 받으면 되는 측정자 → 둘 다 받아야 하는 측정자.
// 같으면 지금 쓰는 기기의 측정자, 그다음 들어볼 기기의 측정자, 그다음 목록 순서(AutoEQ 추천이 앞)

export interface MeasurerSide {
  /** 지금 고른 측정치의 측정자(source) */
  current: string
  /** 이 기기에 이미 저장된 측정치들의 측정자 */
  saved: string[]
  /** 받을 수 있는(AutoEQ·squig.link) 측정자 */
  available: string[]
}

export interface CommonSource {
  source: string
  /** 지금 쓰는 기기 쪽을 받아야 하는지 */
  fetchCurrent: boolean
  /** 들어볼 기기 쪽을 받아야 하는지 */
  fetchWish: boolean
}

export function pickCommonSource(current: MeasurerSide, wish: MeasurerSide): CommonSource | null {
  const all = (s: MeasurerSide) => [...s.saved, ...s.available]
  const wishAll = new Set(all(wish))
  const seen = new Set<string>()
  const candidates: CommonSource[] = []
  for (const source of all(current)) {
    if (seen.has(source) || !wishAll.has(source)) continue
    seen.add(source)
    candidates.push({ source, fetchCurrent: !current.saved.includes(source), fetchWish: !wish.saved.includes(source) })
  }
  const cost = (c: CommonSource) => Number(c.fetchCurrent) + Number(c.fetchWish)
  const rank = (c: CommonSource) => (c.source === current.current ? 0 : c.source === wish.current ? 1 : 2)
  // sort는 같은 값이면 원래 순서를 지킨다(목록 순서 = AutoEQ 추천이 앞)
  candidates.sort((a, b) => cost(a) - cost(b) || rank(a) - rank(b))
  return candidates[0] ?? null
}
