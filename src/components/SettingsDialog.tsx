// 설정 팝업: 보통 앱 설정처럼 한 줄짜리 항목 목록. 화면 테마 → 데이터(백업) → 고급(접힘: 기기 정리, 저장 공간 보존) → 버전
import { useEffect, useState, type ChangeEvent } from 'react'
import { backupFileName, parseBackup, summarize, type BackupData } from '../backup'
import { cleanupStoredDevices, exportAll, importAll } from '../repo'
import { describeCleanup } from '../useStartupCleanup'
import { setThemePref, useThemePref, type ThemePref } from '../theme'
import { Modal } from './Modal'
import { isAndroidApp, saveTextFile } from '../platform'
import { checkForUpdate } from '../appUpdate'
import { buildLabel } from '../buildInfo'
import { ChevronRightIcon } from './Icons'
import { SegmentedGroup } from './SegmentedGroup'
import { askConfirm } from '../confirm'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="설정">
      <div className="settings">
        <ThemeRow />
        <BackupGroup />
        {/* 자주 안 쓰는 항목은 접어 둔다 */}
        <details className="settings-advanced">
          <summary className="settings-group-title">
            <ChevronRightIcon size={14} /> 고급
          </summary>
          <CleanupRow />
          {/* 저장 공간 영구 보존은 브라우저 이야기라 안드로이드 앱에서는 숨긴다(앱 데이터는 앱을 지우기 전까지 남음) */}
          {!isAndroidApp() && <StorageRow />}
        </details>
        {/* 안드로이드 앱: 새 정식 버전이 있는지 바로 확인(평소에는 앱을 열 때 자동으로 확인) */}
        {isAndroidApp() && (
          <button type="button" className="settings-row settings-link" onClick={() => checkForUpdate({ force: true, manual: true })}>
            <span>업데이트 확인</span>
            <ChevronRightIcon />
          </button>
        )}
        {/* 지금 쓰는 앱이 몇 번째 빌드인지(업데이트가 됐는지 확인용) */}
        <p className="settings-version">audio-gear · {buildLabel()}</p>
      </div>
    </Modal>
  )
}

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'system', label: '시스템' },
  { value: 'light', label: '라이트' },
  { value: 'dark', label: '다크' },
]

function ThemeRow() {
  const pref = useThemePref()
  return (
    <div className="settings-row">
      <span>화면 테마</span>
      {/* 세 버튼 중 하나만 눌린 상태가 되는 "세그먼트 버튼". aria-pressed로 눌림 상태를 알린다 */}
      <SegmentedGroup className="small" label="화면 테마">
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
      </SegmentedGroup>
    </div>
  )
}

function BackupGroup() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  // 가져올 파일을 읽어 검사까지 마친 내용. 사용자가 방식을 고르고 확인하면 DB에 넣는다
  const [pending, setPending] = useState<{ fileName: string; data: BackupData } | null>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')

  async function handleExport() {
    setError('')
    const data = await exportAll()
    try {
      // 브라우저는 파일 내려받기, 안드로이드 앱은 공유 창(platform.ts)
      const result = await saveTextFile(backupFileName(), JSON.stringify(data), 'application/json')
      if (result === 'cancelled') {
        setMessage('내보내기를 취소했어요.')
        return
      }
    } catch (e) {
      setError(`내보내지 못했습니다: ${e instanceof Error ? e.message : String(e)}`)
      return
    }
    const s = summarize(data)
    setMessage(`내보냈어요: 기기 ${s.devices}개, 측정치 ${s.measurements}개, EQ ${s.eqPresets}개`)
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
    if (
      mode === 'replace' &&
      !(await askConfirm({
        title: '모두 바꾸기',
        message: '지금 있는 기기·측정치·타깃·탭·EQ를 모두 지우고 백업으로 바꿀까요?',
        ok: '모두 바꾸기',
        danger: true,
      }))
    )
      return
    try {
      await importAll(pending.data, mode)
      setMessage('가져왔어요.')
      setPending(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const summary = pending && summarize(pending.data)

  return (
    <section className="settings-group">
      <h3 className="settings-group-title">데이터</h3>
      <button type="button" className="settings-row settings-link" onClick={handleExport}>
        <span>백업 내보내기</span>
        <ChevronRightIcon />
      </button>
      {/* 파일 선택 칸은 숨기고, 한 줄 항목처럼 보이는 label을 눌러 연다 */}
      <label className="settings-row settings-link">
        <span>백업 가져오기</span>
        <ChevronRightIcon />
        <input type="file" accept=".json,application/json" onChange={handleFile} hidden />
      </label>

      {pending && summary && (
        <div className="import-box">
          <p className="small">
            <strong>{pending.fileName}</strong> · 기기 {summary.devices}개, 측정치 {summary.measurements}개, EQ {summary.eqPresets}개
          </p>
          <SegmentedGroup className="small" label="가져오는 방식">
            <button type="button" className={mode === 'merge' ? 'active' : undefined} aria-pressed={mode === 'merge'} onClick={() => setMode('merge')}>
              합치기
            </button>
            <button type="button" className={mode === 'replace' ? 'active' : undefined} aria-pressed={mode === 'replace'} onClick={() => setMode('replace')}>
              모두 바꾸기
            </button>
          </SegmentedGroup>
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

/** 저장된 기기 이름 정리. 앱을 처음 열 때 한 번 자동으로 하지만, 백업을 가져온 뒤 등에 다시 할 수 있게 둔다 */
function CleanupRow() {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCleanup() {
    const ok = await askConfirm({
      title: '저장된 기기 정리',
      message: '이름을 정리하고 같아진 기기는 하나로 합쳐요(보유·찜·메모·측정치 유지). 기기가 아닌 항목(구분선 등)은 지워요. 계속할까요?',
      ok: '정리',
    })
    if (!ok) return
    setBusy(true)
    try {
      setMessage(describeCleanup(await cleanupStoredDevices()))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button type="button" className="settings-row settings-link" onClick={handleCleanup} disabled={busy}>
        <span>{busy ? '정리 중…' : '저장된 기기 정리'}</span>
        <ChevronRightIcon />
      </button>
      {message && <p className="notice small">{message}</p>}
    </>
  )
}

/**
 * 브라우저 저장소 영구 보존.
 * 브라우저는 저장 공간이 부족하면 오래 안 쓴 사이트 데이터를 지울 수 있다(특히 iOS Safari).
 * navigator.storage.persist()로 "지우지 말아 달라"고 요청할 수 있다. 허락 여부는 브라우저가 정한다.
 */
function StorageRow() {
  const supported = typeof navigator !== 'undefined' && !!navigator.storage?.persist
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usage, setUsage] = useState<string>('')

  useEffect(() => {
    if (!supported) return
    navigator.storage.persisted().then(setPersisted)
    navigator.storage.estimate().then((e) => {
      if (e.usage !== undefined) setUsage(`${(e.usage / 1024 / 1024).toFixed(1)}MB`)
    })
  }, [supported])

  async function handleRequest() {
    setPersisted(await navigator.storage.persist())
  }

  // 브라우저가 지우지 않게 "영구 보존"을 요청한다. 꺼져 있어도 평소에는 데이터가 유지되지만, 홈 화면에 설치하면 허락되기 쉽다
  return (
    <div className="settings-row">
      <span>
        저장 공간 보존
        {usage && <span className="muted small"> · {usage}</span>}
      </span>
      {!supported ? (
        <span className="muted small">지원 안 함</span>
      ) : persisted ? (
        <span className="muted small">켜짐</span>
      ) : persisted === false ? (
        <button type="button" className="small" onClick={handleRequest}>
          켜기
        </button>
      ) : (
        <span className="muted small">확인 중…</span>
      )}
    </div>
  )
}
