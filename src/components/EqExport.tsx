// 만든 EQ를 기기 전체 EQ 앱(Equalizer APO, Wavelet 등)에 넣을 수 있게 복사·저장하는 칸.
// "EQ로 들어보기" 팝업과 EQ 화면이 같이 쓴다.
import { useState } from 'react'
import { defaultApp, detectPlatform, EQ_APPS, eqText, platformLabels, type EqApp, type EqSettings } from '../eqExport'
import { isAndroidApp, saveTextFile } from '../platform'

interface Props {
  eq: EqSettings
  /** 저장할 파일 이름에 붙일 설명(예: "기기 → 목표"). Wavelet은 파일 이름을 프로필 이름으로 보여준다 */
  name: string
}

const platform = detectPlatform()

/** 이 브라우저가 파일 공유(폰의 공유 메뉴로 다른 앱에 보내기)를 지원하는지 */
function canShareFiles(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

export function EqExport({ eq, name }: Props) {
  const [app, setApp] = useState<EqApp>(defaultApp(platform))
  // 무엇을 복사했는지 기억해서, 내용이 바뀌면 "복사됨" 표시가 저절로 사라지게 한다
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [shareFailed, setShareFailed] = useState(false)

  const text = eqText(app, eq)
  // 파일 이름에 못 쓰는 글자는 뺀다. Wavelet은 파일 이름이 곧 프로필 이름이라 앞에 "audio-gear-eq"를 붙이지 않는다
  const cleanName = name.replace(/[\\/:*?"<>|]/g, '').trim() || 'EQ'
  const fileName = app === 'wavelet' ? `${cleanName}.txt` : `audio-gear-eq ${cleanName}.txt`
  const file = new File([text], fileName, { type: 'text/plain' })
  // 안드로이드 앱에서는 "파일로 저장"이 이미 공유 창을 열어서 공유 버튼을 따로 두지 않는다
  const shareable = !isAndroidApp() && canShareFiles(file)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(text)
    } catch {
      // 브라우저가 클립보드 쓰기를 막으면(권한, 창이 포커스 안 됨 등) 글을 선택해 두고 직접 복사하게 한다
      const area = document.querySelector<HTMLTextAreaElement>('.eq-text')
      area?.focus()
      area?.select()
      setCopyFailed(true)
    }
  }

  // 브라우저는 파일 내려받기, 안드로이드 앱은 공유 창(platform.ts)
  async function handleSave() {
    setShareFailed(false)
    try {
      await saveTextFile(fileName, text, 'text/plain')
    } catch {
      setShareFailed(true)
    }
  }

  // Web Share API: 폰의 공유 메뉴를 열어 파일을 다른 앱(Wavelet, 파일 앱, 메신저 등)으로 바로 보낸다
  async function handleShare() {
    setShareFailed(false)
    try {
      await navigator.share({ files: [file], title: fileName })
    } catch (e) {
      // 사용자가 공유 메뉴를 그냥 닫은 경우(AbortError)는 실패가 아니다
      if (!(e instanceof DOMException && e.name === 'AbortError')) setShareFailed(true)
    }
  }

  return (
    <>
      <h3>EQ 앱에 넣기</h3>
      <div className="row">
        <div className="segmented" role="group" aria-label="EQ 앱">
          {(Object.keys(EQ_APPS) as EqApp[]).map((key) => (
            <button
              key={key}
              type="button"
              className={app === key ? 'active' : undefined}
              aria-pressed={app === key}
              onClick={() => setApp(key)}
            >
              {EQ_APPS[key].label}
            </button>
          ))}
        </div>
      </div>
      <p className="muted small">
        이 기기: {platformLabels[platform]}
        {platform === 'ios'
          ? ' — iPhone은 다른 앱(스트리밍) 소리에 EQ를 거는 앱을 허용하지 않아서, PC나 Android에서 들어보는 것을 추천합니다.'
          : ` — 기본으로 ${EQ_APPS[defaultApp(platform)].label}을(를) 골랐습니다.`}
      </p>
      <ol className="small howto">
        {EQ_APPS[app].howto.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ol>
      <textarea className="eq-text" readOnly value={text} rows={Math.min(12, text.split('\n').length + 1)} />
      <div className="row">
        <button type="button" className="primary" onClick={handleCopy}>
          {copiedText === text ? '복사됨' : '복사'}
        </button>
        <button type="button" onClick={handleSave}>
          파일로 저장
        </button>
        {shareable && (
          <button type="button" onClick={handleShare} title="폰의 공유 메뉴로 다른 앱에 파일 보내기">
            공유
          </button>
        )}
        {shareFailed && (
          <span className="error small">
            {isAndroidApp() ? '파일을 내보내지 못했습니다. 복사를 써 주세요.' : '공유하지 못했습니다. "파일로 저장"을 써 주세요.'}
          </span>
        )}
        {copyFailed && <span className="error small">자동 복사가 막혔습니다. 선택된 글을 Ctrl+C로 복사하세요.</span>}
      </div>
    </>
  )
}
