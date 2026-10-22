// 화면에 보여줄 한글 이름표. 선택 상자(select)의 선택지로도 쓴다.
import type { Channel, DeviceCategory, Measurement, Rig } from './types'

export const categoryLabels: Record<DeviceCategory, string> = {
  headphone: '헤드폰',
  iem: '이어폰',
}

export const rigLabels: Record<Rig, string> = {
  '5128': 'B&K 5128',
  '711': 'IEC 711',
  gras: 'GRAS',
  other: '기타',
}

export const channelLabels: Record<Channel, string> = {
  avg: '평균',
  L: '왼쪽(L)',
  R: '오른쪽(R)',
}

/** 측정치 출처를 사람이 읽기 좋게. 'local'은 "직접 업로드" */
export function sourceLabel(source: string): string {
  return source === 'local' ? '직접 업로드' : source
}

/** 같은 기기의 측정치끼리 구분하는 짧은 이름: 구성이 있으면 구성, 없으면 출처 */
export function measurementLabel(m: Measurement): string {
  return m.variant || sourceLabel(m.source)
}
