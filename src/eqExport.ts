// 만든 EQ를 기기 전체 EQ 앱이 읽는 글자 형식으로 바꾸고, 지금 기기(OS)에 맞는 앱을 골라 준다.
// 웹앱은 Spotify 같은 다른 앱의 소리를 바꿀 수 없어서, EQ 앱에 넘겨 그 앱에서 켜고 끄는 방식으로 미리 듣는다.
import { peakResponse, type EqResult } from './eq'
import { logGrid } from './curve'

export type Platform = 'windows' | 'android' | 'mac' | 'ios' | 'other'
export type EqApp = 'equalizer-apo' | 'wavelet' | 'manual'

export const platformLabels: Record<Platform, string> = {
  windows: 'Windows',
  android: 'Android',
  mac: 'Mac',
  ios: 'iPhone/iPad',
  other: '알 수 없음',
}

export const EQ_APPS: Record<EqApp, { label: string; howto: string[] }> = {
  'equalizer-apo': {
    label: 'Equalizer APO (Windows)',
    howto: [
      'Equalizer APO를 설치하고, 쓰는 출력 장치(헤드폰)를 고른다.',
      '파일로 저장한 뒤 Peace(Equalizer APO용 무료 화면 프로그램)에서 불러오거나, Equalizer APO의 config 폴더에 있는 config.txt 끝에 복사한 내용을 붙여 넣는다.',
      '원래 소리로 돌아가려면 Peace에서 끄거나 붙여 넣은 줄을 지운다. 켜고 끄면서 비교하면 된다.',
    ],
  },
  wavelet: {
    label: 'Wavelet (Android)',
    howto: [
      'Wavelet에서 그래픽 EQ(AutoEq 형식) 가져오기로 저장한 파일을 열거나 복사한 내용을 붙여 넣는다. 메뉴 이름은 앱 버전에 따라 다를 수 있다.',
      'Wavelet은 스트리밍 앱을 포함한 폰 전체 소리에 적용된다. Wavelet의 켜기/끄기로 원래 소리와 비교한다.',
    ],
  },
  manual: {
    label: '직접 입력 (PEQ 값)',
    howto: [
      '파라메트릭 EQ를 지원하는 앱(eqMac, 플레이어 앱의 PEQ 등)에 아래 필터 값을 하나씩 입력한다. 형식(PK = 피크 필터, Fc = 중심 주파수)은 Equalizer APO 표기와 같다.',
      '프리앰프(전체 음량)도 함께 낮춰야 소리가 깨지지 않는다.',
    ],
  },
}

/** 지금 이 앱을 연 기기의 OS를 알아낸다(브라우저가 알려주는 정보 기준) */
export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'android'
  // 최근 아이패드는 맥처럼 보이지만 터치가 된다
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Windows/i.test(ua)) return 'windows'
  if (/Macintosh|Mac OS/i.test(ua)) return 'mac'
  return 'other'
}

/** OS에 맞는 기본 EQ 앱 */
export function defaultApp(platform: Platform): EqApp {
  if (platform === 'windows') return 'equalizer-apo'
  if (platform === 'android') return 'wavelet'
  return 'manual'
}

/** Equalizer APO 형식(파라메트릭). 다른 PEQ 앱도 대부분 같은 표기를 쓴다 */
/** 내보내기에 필요한 값: 필터와 프리앰프 */
export type EqSettings = Pick<EqResult, 'filters' | 'preamp'>

export function toParametricText(eq: EqSettings): string {
  const lines = [`Preamp: ${eq.preamp.toFixed(1)} dB`]
  eq.filters.forEach((f, i) => {
    lines.push(`Filter ${i + 1}: ON PK Fc ${f.freq} Hz Gain ${f.gain.toFixed(1)} dB Q ${f.q.toFixed(2)}`)
  })
  return lines.join('\n') + '\n'
}

/**
 * AutoEq GraphicEQ 형식: "GraphicEQ: 주파수 dB; 주파수 dB; ..." 한 줄.
 * 필터를 모두 건 결과를 1/12옥타브 간격으로 적고, 프리앰프를 미리 더해 둔다(가장 큰 값이 0dB 이하)
 */
export function toGraphicText(eq: EqSettings): string {
  const freqs = logGrid(20, 20000, 12).map((f) => Math.round(f))
  const total = freqs.map(() => eq.preamp)
  for (const filter of eq.filters) peakResponse(filter, freqs).forEach((v, i) => (total[i] += v))
  return 'GraphicEQ: ' + freqs.map((f, i) => `${f} ${total[i].toFixed(1)}`).join('; ') + '\n'
}

export function eqText(app: EqApp, eq: EqSettings): string {
  return app === 'wavelet' ? toGraphicText(eq) : toParametricText(eq)
}
