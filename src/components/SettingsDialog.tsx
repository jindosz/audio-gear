// 설정 팝업: 화면 테마, 백업 내보내기/가져오기, 브라우저 저장소 영구 보존
import { useEffect, useState, type ChangeEvent } from 'react'
import { backupFileName, parseBackup, summarize, type BackupData } from '../backup'
import { exportAll, importAll } from '../repo'
import { setThemePref, useThemePref, type ThemePref } from '../theme'
import { Modal } from './Modal'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="설정">
      <div className="detail settings">
        <ThemeSection />
        <BackupSection />
        <StorageSection />
      </div>
    </Modal>
  )
}

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: '시스템 설정' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
]

function ThemeSection() {
  const pref = useThemePref()
  return (
    <section>
      <h3>화면 테마</h3>
      {/* 세 버튼 중 하나만 눌린 상태가 되는 "세그먼트 버튼". aria-pressed로 눌림 상태를 알린다 */}
      <div className="segmented" role="group" aria-label="화면 테마">
        {THEME_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            className={pref === o.value ? 'active' : undefined}
            aria-pressed={pref === o.value}
            onClick={() => setThemePref(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="muted small">시스템 설정을 고르면 운영체제의 라이트/다크 설정을 따라 자동으로 바뀝니다.</p>
    </section>
  )
}

function BackupSection() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  // 가져올 파일을 읽어 검사까지 마친 내용. 사용자가 방식을 고르고 확인하면 DB에 넣는다
  const [pending, setPending] = useState<{ fileName: string; data: BackupData } | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')

  async function handleExport() {
    setError('')
    const data = await exportAll()
    // Blob: 메모리에 만든 파일. 임시 주소(URL)를 만들어 <a download>로 내려받게 한 뒤 주소를 지운다
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = backupFileName()
    a.click()
    URL.revokeObjectURL(url)
    const s = summarize(data)
    setMessage(`내보냈습니다: 기기 ${s.devices}개, 측정치 ${s.measurements}개, 타깃 ${s.targets}개, 탭 ${s.tabs}개`)
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 골라도 change가 일어나도록 비워 둔다
    setMessage('')
    setError('')
    setPending(null)
    if (!file) return
    try {
      setPending({ fileName: file.name, data: parseBackup(await file.text()) })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleImport() {
    if (!pending) return
    if (mode === 'replace' && !confirm('지금 있는 기기·측정치·타깃·탭을 모두 지우고 백업으로 바꿉니다. 계속할까요?')) return
    try {
      await importAll(pending.data, mode)
      setMessage(`${pending.fileName}을(를) 가져왔습니다.`)
      setPending(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const summary = pending && summarize(pending.data)

  return (
    <section>
      <h3>백업</h3>
      <p className="muted small">
        기기·측정치·타깃·비교 탭을 JSON 파일로 저장하거나 불러옵니다. 브라우저 데이터가 지워질 때를 대비해 가끔
        내보내 두세요. (AutoEQ 목록은 다시 받을 수 있어서 백업에 넣지 않습니다.)
      </p>
      <div className="row">
        <button type="button" onClick={handleExport}>
          백업 파일 내보내기
        </button>
        {/* 파일 선택 칸은 숨기고, 버튼처럼 보이는 label을 눌러 연다 */}
        <label className="file-button">
          백업 파일 가져오기…
          <input type="file" accept=".json,application/json" onChange={handleFile} hidden />
        </label>
      </div>

      {pending && summary && (
        <div className="import-box">
          <p className="small">
            <strong>{pending.fileName}</strong>: 기기 {summary.devices}개, 측정치 {summary.measurements}개, 타깃{' '}
            {summary.targets}개, 탭 {summary.tabs}개
            {pending.data.exportedAt && (
              <span className="muted"> · {new Date(pending.data.exportedAt).toLocaleString()}에 내보냄</span>
            )}
          </p>
          <div className="segmented" role="group" aria-label="가져오는 방식">
            <button type="button" className={mode === 'merge' ? 'active' : undefined} aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}>
              지금 데이터에 합치기
            </button>
            <button type="button" className={mode === 'replace' ? 'active' : undefined} aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}>
              모두 지우고 바꾸기
            </button>
          </div>
          <p className="muted small">
            {mode === 'merge' ? '지금 데이터는 두고, 같은 항목은 백업 내용으로 바뀝니다.' : '지금 있는 기기·측정치·타깃·탭을 모두 지우고 백업으로 바꿉니다.'}
          </p>
          <div className="row">
            <button type="button" className="primary" onClick={handleImport}>
              가져오기
            </button>
            <button type="button" onClick={() => setPending(null)}>
              취소
            </button>
          </div>
        </div>
      )}

      {message && <p className="notice small">{message}</p>}
      {error && <p className="error small">{error}</p>}
    </section>
  )
}

/**
 * 브라우저 저장소 영구 보존.
 * 브라우저는 저장 공간이 부족하면 오래 안 쓴 사이트 데이터를 지울 수 있다(특히 iOS Safari).
 * navigator.storage.persist()로 "지우지 말아 달라"고 요청할 수 있다. 허락 여부는 브라우저가 정한다.
 */
function StorageSection() {
  const supported = typeof navigator !== 'undefined' && !!navigator.storage?.persist
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<string>('')

  useEffect(() => {
    if (!supported) return
    navigator.storage.persisted().then(setPersisted)
    navigator.storage.estimate().then((e) => {
      if (e.usage !== undefined) setUsage(`${(e.usage / 1024 / 1024).toFixed(1)}MB 사용 중`)
    })
  }, [supported])

  async function handleRequest() {
    setPersisted(await navigator.storage.persist())
  }

  return (
    <section>
      <h3>저장소</h3>
      {!supported ? (
        <p className="muted small">이 브라우저는 저장소 보존 요청을 지원하지 않습니다. 백업을 자주 내보내 두세요.</p>
      ) : (
        <>
          <p className="small">
            영구 보존: <strong>{persisted === null ? '확인 중…' : persisted ? '켜짐' : '꺼짐'}</strong>
            {usage && <span className="muted"> · {usage}</span>}
          </p>
          {persisted === false && (
            <>
              <button type="button" onClick={handleRequest}>
                영구 보존 요청
              </button>
              <p className="muted small">
                브라우저가 거절할 수 있습니다(사이트를 자주 쓰거나 홈 화면에 설치하면 허락되기 쉬움). 꺼져 있어도
                평소에는 데이터가 유지되지만, 백업을 함께 해 두는 것이 안전합니다.
              </p>
            </>
          )}
        </>
      )}
    </section>
  )
}
