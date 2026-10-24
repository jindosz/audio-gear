// 만든 EQ를 기기 전체 EQ 앱(Equalizer APO, Wavelet 등)에 넣을 수 있게 복사·저장하는 칸.
// "EQ로 들어보기" 팝업과 EQ 화면이 같이 쓴다.
import { useState } from 'react'
import { defaultApp, detectPlatform, EQ_APPS, eqText, platformLabels, type EqApp, type EqSettings } from '../eqExport'

interface Props {
  eq: EqSettings
  /** 저장할 파일 이름에 붙일 설명(예: 들어볼 기기 이름) */
  name: string
}

const platform = detectPlatform()

export function EqExport({ eq, name }: Props) {
  const [app, setApp] = useState<EqApp>(defaultApp(platform))
  // 무엇을 복사했는지 기억해서, 내용이 바뀌면 "복사됨" 표시가 저절로 사라지게 한다
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)

  const text = eqText(app, eq)
  const fileName = `audio-gear-eq ${name.replace(/[\\/:*?"<>|]/g, '')}.txt` // 파일 이름에 못 쓰는 글자는 뺀다

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

  function handleSave() {
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
    URL.revokeObjectURL(url)
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
        {copyFailed && <span className="error small">자동 복사가 막혔습니다. 선택된 글을 Ctrl+C로 복사하세요.</span>}
      </div>
    </>
  )
}
