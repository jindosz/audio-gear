// 화면에 보여줄 한글 이름표. 선택 상자(select)의 선택지로도 쓴다.
import type { Channel, DeviceCategory, Rig } from './types'

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
