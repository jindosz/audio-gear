// 만든 EQ를 기기 전체 EQ 앱이 읽는 글자 형식으로 바꾸고, 지금 기기(OS)에 맞는 앱을 골라 준다.
// 웹앱은 Spotify 같은 다른 앱의 소리를 바꿀 수 없어서, EQ 앱에 넘겨 그 앱에서 켜고 끄는 방식으로 미리 듣는다.
import { peakResponse, type EqResult } from './eq'

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
      '"파일로 저장"(또는 "공유" → 파일 앱에 저장)으로 파일을 받은 뒤, Wavelet의 가져오기(Import)로 그 파일을 연다. Wavelet은 파일 이름을 프로필 이름으로 보여준다. 메뉴 이름은 앱 버전에 따라 다를 수 있다.',
      '한 번 가져온 프로필은 Wavelet 안에서 골라 쓰면 된다. 이어폰·헤드폰을 바꿔 연결했을 때 프로필이 자동으로 바뀌는지는 Wavelet 버전에 따라 다를 수 있으니 한 번 확인한다.',
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
 * Wavelet이 받는 GraphicEQ 주파수 127개(AutoEq 출력과 같은 목록).
 * Wavelet 문서(github.com/Pittvandewitt/Wavelet, docs/Import.md): 주파수를 더하거나 바꾸거나 빼면 가져오기가 실패한다.
 * 그래서 계산으로 만들지 않고 문서의 목록을 그대로 적어 둔다
 */
export const GRAPHIC_EQ_FREQS: readonly number[] = [
  20, 21, 22, 23, 24, 26, 27, 29, 30, 32, 34, 36, 38, 40, 43, 45, 48, 50, 53, 56, 59, 63, 66, 70, 74, 78, 83,
  87, 92, 97, 103, 109, 115, 121, 128, 136, 143, 151, 160, 169, 178, 188, 199, 210, 222, 235, 248, 262, 277,
  292, 309, 326, 345, 364, 385, 406, 429, 453, 479, 506, 534, 565, 596, 630, 665, 703, 743, 784, 829, 875,
  924, 977, 1032, 1090, 1151, 1216, 1284, 1357, 1433, 1514, 1599, 1689, 1784, 1885, 1991, 2103, 2221, 2347,
  2479, 2618, 2766, 2921, 3086, 3260, 3443, 3637, 3842, 4058, 4287, 4528, 4783, 5052, 5337, 5637, 5955, 6290,
  6644, 7018, 7414, 7831, 8272, 8738, 9230, 9749, 10298, 10878, 11490, 12137, 12821, 13543, 14305, 15110,
  15961, 16860, 17809, 18812, 19871,
]

/**
 * AutoEq GraphicEQ 형식: "GraphicEQ: 주파수 dB; 주파수 dB; ..." 한 줄.
 * 필터를 모두 건 결과를 위 127개 주파수에서 적고, 프리앰프를 미리 더해 둔다(가장 큰 값이 0dB 이하)
 */
export function toGraphicText(eq: EqSettings): string {
  const freqs = [...GRAPHIC_EQ_FREQS]
  const total = freqs.map(() => eq.preamp)
  for (const filter of eq.filters) peakResponse(filter, freqs).forEach((v, i) => (total[i] += v))
  // toFixed는 -0.04 같은 값을 "-0.0"으로 적어서, 0이 되는 값은 "0.0"으로 고친다
  const fmt = (v: number) => (Math.abs(v) < 0.05 ? '0.0' : v.toFixed(1))
  return 'GraphicEQ: ' + freqs.map((f, i) => `${f} ${fmt(total[i])}`).join('; ') + '\n'
}

export function eqText(app: EqApp, eq: EqSettings): string {
  return app === 'wavelet' ? toGraphicText(eq) : toParametricText(eq)
}
