// 설정 팝업: 보통 앱 설정처럼 한 줄짜리 항목 목록. 화면 테마 → 데이터(백업) → 고급(접힘: 기기 정리, 저장 공간 보존) → 버전
import { useEffect, useState, type ChangeEvent } from 'react'
import { backupFileName, parseBackup, summarize, type BackupData } from '../backup'
import { cleanupStoredDevices, exportAll, importAll } from '../repo'
import { describeCleanup } from '../useStartupCleanup'
import { setThemePref, useThemePref, type ThemePref } from '../theme'
import { Modal } from './Modal'
import { AccountRow } from './AccountGroup'
import { CatalogDataBox } from './CatalogDataBox'
import { startAllSummaryJobs, useSummaryJob } from '../summaryJob'
import { setSoundTagsEnabled, useSoundTagsEnabled } from '../useSoundTagger'
import { Help } from './Help'
import { isAndroidApp, saveTextFile } from '../platform'
import { checkForUpdate, PREVIEW_UPDATES_KEY, previewUpdatesOn } from '../appUpdate'
import { buildLabel } from '../buildInfo'
import { ChevronRightIcon } from './Icons'
import { SegmentedGroup } from './SegmentedGroup'
import { askChoice, askConfirm } from '../confirm'
import { ToggleButton } from './ToggleButton'
import { writePref } from '../localPrefs'
import { getEarBalance, restoreEarBalance, setEarBalanceOn, useEarBalance } from '../earBalanceStore'
import { balanceLabel } from '../earBalance'
import { useEqStatus } from '../eqEngine'
import { EarBalanceDialog } from './EarBalanceDialog'
import { EarEqDialog } from './EarEqDialog'
import { EarEqResult } from './EarEqResult'
import { getEarProfile, saveEarProfile, setEarEqOn, useEarProfile } from '../earEqStore'
import { showToast } from '../toast'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsDialog({ open, onClose }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="설정">
      <div className="settings">
        <AccountRow />
        <ThemeRow />
        <SoundTagsRow />
        <EarBalanceRow />
        <EarEqRow />
        <BackupGroup />
        {/* 측정치 미리 받기: 받아 두면 기기 목록에 성향 태그가 보이고 비슷한 기기 찾기 후보가 된다 */}
        {/* 자주 안 여는 칸이라 접어 둔다(받는 중이면 제목 옆에 진행 표시) */}
        <details className="settings-advanced">
          <summary className="settings-group-title">
            <ChevronRightIcon size={14} /> 측정치 미리 받기
            <SummaryJobBadge />
          </summary>
          <AllDownloadRow />
          <CatalogDataBox category="headphone" title="헤드폰" />
          <CatalogDataBox category="iem" title="이어폰" />
          <Help>
            목록 기기의 측정치를 요약(곡선마다 숫자 60개 정도)해서 저장해요. AutoEQ에 있는 기기는 AutoEQ 추천 측정치, squig.link에만
            있는 기기는 squig.link 측정치를 받아요. 받아 두면 목록에 성향 태그가 보이고 비슷한 기기 찾기 후보가 돼요. 이어폰은 1만 개가
            넘어 시간이 꽤 걸리지만, 화면을 닫아도 계속 받고 멈췄다가 이어 받을 수 있어요. 한 번에 한 종류씩 받아요.
          </Help>
        </details>
        {/* 자주 안 쓰는 항목은 접어 둔다 */}
        <details className="settings-advanced">
          <summary className="settings-group-title">
            <ChevronRightIcon size={14} /> 고급
          </summary>
          <CleanupRow />
          {/* 저장 공간 영구 보존은 브라우저 이야기라 안드로이드 앱에서는 숨긴다(앱 데이터는 앱을 지우기 전까지 남음) */}
          {!isAndroidApp() && <StorageRow />}
          {isAndroidApp() && <PreviewUpdateRow />}
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
  // 내 귀 설정(균형·보정): 내보낼 때 그때마다 묻고(있을 때만), 가져올 때 받을지(기본 받음)
  const earBalance = useEarBalance()
  const earProfile = useEarProfile()
  const hasEar = !!earBalance || !!earProfile
  const [importEar, setImportEar] = useState(true)

  async function handleExport() {
    setError('')
    let withEar = false
    if (hasEar) {
      const answer = await askChoice({
        title: '내 귀 설정',
        message: '내 귀 균형·보정 결과도 백업에 넣을까요?',
        ok: '넣기',
        cancel: '빼기',
      })
      if (answer === null) return // 고르지 않고 닫음 = 내보내기 그만
      withEar = answer
    }
    const data = await exportAll()
    if (withEar) data.ear = { balance: getEarBalance(), profile: getEarProfile() }
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
    setMessage(`내보냈어요: 기기 ${s.devices}개, 측정치 ${s.measurements}개, EQ ${s.eqPresets}개${data.ear ? ', 내 귀 설정' : ''}`)
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 골라도 change가 일어나도록 비워 둔다
    setMessage('')
    setError('')
    setPending(null)
    setImportEar(true)
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
      const ear = importEar ? pending.data.ear : undefined
      if (ear?.balance) await restoreEarBalance(ear.balance)
      if (ear?.profile) await saveEarProfile(ear.profile)
      setMessage(ear ? '가져왔어요(내 귀 설정 포함).' : '가져왔어요.')
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
          {pending.data.ear && (
            <div className="settings-row">
              <span className="small">
                내 귀 설정도 가져오기
                <span className="muted"> · 지금 설정을 덮어써요</span>
              </span>
              <ToggleButton small on={importEar} onChange={setImportEar}>
                {importEar ? '가져옴' : '안 가져옴'}
              </ToggleButton>
            </div>
          )}
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

/** 시험용(나중에 지울 것): 켜면 앱 안 업데이트가 미리 보기 빌드(android-preview)까지 확인한다 */
function PreviewUpdateRow() {
  const [on, setOn] = useState(previewUpdatesOn)
  return (
    <div className="settings-row">
      <span>미리 보기 빌드도 업데이트(시험용)</span>
      <ToggleButton
        small
        on={on}
        onChange={(next) => {
          setOn(next)
          writePref(PREVIEW_UPDATES_KEY, next)
        }}
      >
        {on ? '켜짐' : '꺼짐'}
      </ToggleButton>
    </div>
  )
}

/** 성향 태그 보기 켜고 끄기(그래프 범례·기기 목록·기기 상세·비슷한 기기 찾기 결과) */
function SoundTagsRow() {
  const on = useSoundTagsEnabled()
  return (
    <div className="settings-row">
      <span>성향 태그 보기</span>
      <ToggleButton small on={on} onChange={setSoundTagsEnabled}>
        {on ? '켜짐' : '꺼짐'}
      </ToggleButton>
    </div>
  )
}

/**
 * 내 귀 균형: 잰 값, 켜고 끄기(안드로이드 앱), [재기].
 * 알림의 "끄기"로 폰 효과를 다 껐으면 설정은 켜짐이어도 "꺼짐"으로 보이고, 누르면 다시 건다
 */
function EarBalanceRow() {
  const balance = useEarBalance()
  const status = useEqStatus()
  const [testing, setTesting] = useState(false)
  const android = isAndroidApp()
  const on = !!balance?.on && !!status?.on
  return (
    <div className="settings-row">
      <span>
        내 귀 균형
        <span className="muted small">
          {' · '}
          {balance ? balanceLabel(balance.db) : '아직 안 쟀어요'}
          {balance && !android && ' (안드로이드 앱에서 적용돼요)'}
        </span>
      </span>
      <span className="settings-row-actions">
        {balance && android && (
          <ToggleButton small on={on} onChange={(next) => void setEarBalanceOn(next)}>
            {on ? '켜짐' : '꺼짐'}
          </ToggleButton>
        )}
        <button type="button" className="small" onClick={() => setTesting(true)}>
          재기
        </button>
      </span>
      <EarBalanceDialog open={testing} onClose={() => setTesting(false)} />
    </div>
  )
}

/**
 * 내 귀 보정: 잰 날짜·기기, 켜고 끄기(안드로이드 앱), [결과](그래프·세기), [재기].
 * 알림의 "끄기"로 폰 효과를 다 껐으면 설정은 켜짐이어도 "꺼짐"으로 보이고, 누르면 다시 건다
 */
function EarEqRow() {
  const profile = useEarProfile()
  const status = useEqStatus()
  const [testing, setTesting] = useState(false)
  const [viewing, setViewing] = useState(false)
  const android = isAndroidApp()
  const on = !!profile?.on && !!status?.on
  const when = profile ? new Date(profile.measuredAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : ''
  return (
    <div className="settings-row">
      <span>
        내 귀 보정
        <span className="muted small">
          {' · '}
          {profile ? `${when}${profile.device ? ` · ${profile.device.label}` : ''}` : '아직 안 쟀어요'}
          {profile && !android && ' (안드로이드 앱에서 적용돼요)'}
        </span>
      </span>
      <span className="settings-row-actions">
        {profile && android && (
          <ToggleButton small on={on} onChange={(next) => void setEarEqOn(next)}>
            {on ? '켜짐' : '꺼짐'}
          </ToggleButton>
        )}
        {profile && (
          <button type="button" className="small" onClick={() => setViewing(true)}>
            결과
          </button>
        )}
        <button type="button" className="small" onClick={() => setTesting(true)}>
          재기
        </button>
      </span>
      <EarEqDialog open={testing} onClose={() => setTesting(false)} />
      <Modal open={viewing} onClose={() => setViewing(false)} title="내 귀 보정 결과">
        {profile && (
          <EarEqResult
            profile={profile}
            saveLabel="저장"
            onSave={(p) => {
              void saveEarProfile(p).then(() => showToast('저장했어요'))
              setViewing(false)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

/** 접힌 "측정치 미리 받기" 제목 옆: 받는 중이면 "받는 중"(접혀 있어도 돌고 있는 걸 알 수 있게) */
function SummaryJobBadge() {
  const job = useSummaryJob()
  if (job.status !== 'running' && job.status !== 'stopping') return null
  return <span className="muted small"> · 받는 중</span>
}

/** [전체 받기]: 헤드폰 → 이어폰을 차례로(이미 받은 것은 건너뜀). 받는 중에는 누를 수 없고, 멈추기는 각 상자에서 */
function AllDownloadRow() {
  const job = useSummaryJob()
  const running = job.status === 'running' || job.status === 'stopping'
  return (
    <div className="settings-row">
      <span>헤드폰·이어폰 전체</span>
      <button type="button" className="primary small" onClick={() => void startAllSummaryJobs()} disabled={running}>
        {running ? '받는 중…' : '전체 받기'}
      </button>
    </div>
  )
}
