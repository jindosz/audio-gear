// 측정치 CSV(텍스트)를 FrCurve로 바꾸는 함수.
// 화면이나 DB와 상관없는 "순수 함수"라서 따로 떼어 두면 테스트하기 쉽다.
import type { FrCurve } from './types'

export interface ParseResult {
  curve: FrCurve
  /** 숫자로 읽지 못해 건너뛴 줄 수(헤더, 주석 포함) */
  skippedLines: number
}

/**
 * "주파수, dB" 형식의 텍스트를 읽는다.
 * - 구분자: 쉼표, 탭, 세미콜론, 공백 모두 허용 (REW 내보내기 형식 포함)
 * - 세미콜론/탭 구분일 때는 소수점 쉼표(예: 1000;85,3)도 허용
 * - 세 번째 열 이후(위상 등)는 무시
 * - 헤더나 '*', '#'로 시작하는 주석 줄은 건너뜀
 * - 결과는 주파수 오름차순 정렬, 같은 주파수가 반복되면 처음 값만 사용
 */
export function parseFrCsv(text: string): ParseResult {
  const points: FrCurve = []
  let skippedLines = 0

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line === '') continue

    const cells = splitLine(line)
    const freq = Number(cells[0])
    const db = Number(cells[1])

    // Number('abc')는 NaN이 된다. 숫자가 아니거나 주파수가 0 이하면 건너뜀
    if (cells.length < 2 || !Number.isFinite(freq) || !Number.isFinite(db) || freq <= 0) {
      skippedLines++
      continue
    }
    points.push({ freq, db })
  }

  points.sort((a, b) => a.freq - b.freq)
  const curve = points.filter((p, i) => i === 0 || p.freq !== points[i - 1].freq)

  if (curve.length < 2) {
    throw new Error('주파수,dB 형식의 숫자 데이터를 2줄 이상 찾지 못했습니다.')
  }
  return { curve, skippedLines }
}

function splitLine(line: string): string[] {
  if (line.includes(';') || line.includes('\t')) {
    return line.split(/[;\t]/).map((c) => c.trim().replace(',', '.'))
  }
  return line.split(/[,\s]+/).map((c) => c.trim())
}
