// 계정: 설정 맨 위 한 줄(AccountRow) → 누르면 로그인 전엔 로그인 팝업, 로그인 후엔 "계정" 화면(AccountDialog).
// 계정 화면: 이메일·마지막 동기화·[지금 동기화], 내 귀 설정 동기화, 로그아웃, 계정 삭제
// (설정이 길어져서 2026-11-21 따로 뺌)
import { useEffect, useState } from 'react'
import { deleteAccountAndData, loadAccount, signOutAccount, syncNow, useAccount } from '../account'
import { askConfirm } from '../confirm'
import { readPref, writePref } from '../localPrefs'
import { resetEarSyncState, SYNC_EAR_KEY } from '../syncRunner'
import { showToast } from '../toast'
import { ChevronRightIcon } from './Icons'
import { Modal } from './Modal'
import { ToggleButton } from './ToggleButton'
import { Help } from './Help'
import { SignInDialog } from './SignInDialog'

/** "방금" / "3분 전" / "2시간 전" / "11월 20일" */
function ago(t: number): string {
  const s = (Date.now() - t) / 1000
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return new Date(t).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

/** 설정 맨 위 한 줄: "계정 · 이메일(또는 로그인 / 가입)" › */
export function AccountRow() {
  const account = useAccount()
  const [signingIn, setSigningIn] = useState(false)
  const [open, setOpen] = useState(false)
  // 설정을 열 때 서버를 불러온다(로그인한 적 없으면 앱을 열 때는 안 불러옴)
  useEffect(() => {
    void loadAccount()
  }, [])

  const disabled = !account.loaded || !account.configured
  const right = !account.loaded
    ? '불러오는 중…'
    : !account.configured
      ? '서버가 설정되지 않았어요'
      : account.user
        ? account.user.email
        : '로그인 / 가입'
  return (
    <>
      <button
        type="button"
        className="settings-row settings-link account-entry"
        disabled={disabled}
        onClick={() => (account.user ? setOpen(true) : setSigningIn(true))}
      >
        <span>계정</span>
        <span className="account-entry-value muted small">
          {right}
          {account.user && account.syncing && ' · 동기화 중…'}
        </span>
        <ChevronRightIcon />
      </button>
      <SignInDialog open={signingIn} onClose={() => setSigningIn(false)} />
      <AccountDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

/** "계정" 화면 */
function AccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const account = useAccount()
  const [syncEar, setSyncEar] = useState(() => readPref<boolean>(SYNC_EAR_KEY, false))

  async function removeAccount() {
    const ok = await askConfirm({
      title: '계정 삭제',
      message: '서버에 올린 내 데이터와 계정을 지울까요? 이 기기의 데이터는 그대로 남아요.',
      ok: '계정 삭제',
      danger: true,
    })
    if (!ok) return
    showToast('계정을 지우는 중…', 10000)
    try {
      await deleteAccountAndData()
      showToast('계정을 지웠어요')
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : '계정을 지우지 못했어요')
    }
  }

  async function signOut() {
    await signOutAccount()
    showToast('로그아웃했어요(이 기기 데이터는 그대로예요)')
    onClose()
  }

  const user = account.user
  return (
    <Modal open={open} onClose={onClose} title="계정">
      {user && (
        <div className="settings">
          {/* 이메일이 길어도 버튼이 밀려나지 않게: 이메일·상태는 두 줄로, 길면 … */}
          <div className="settings-row account-row">
            <span className="account-info">
              <span className="account-email">{user.email}</span>
              <span className="muted small">
                {account.syncing
                  ? '동기화 중…'
                  : account.error
                    ? account.error
                    : account.lastSyncAt
                      ? `${ago(account.lastSyncAt)} 동기화`
                      : '아직 동기화 안 함'}
              </span>
            </span>
            <button type="button" className="small primary" disabled={account.syncing} onClick={() => void syncNow(true)}>
              지금 동기화
            </button>
          </div>
          <div className="settings-row">
            <span>
              내 귀 설정 동기화<span className="muted small"> · 균형·보정</span>
            </span>
            <ToggleButton
              small
              on={syncEar}
              onChange={(next) => {
                setSyncEar(next)
                writePref(SYNC_EAR_KEY, next)
                if (next) {
                  resetEarSyncState(user.uid)
                  void syncNow()
                }
              }}
            >
              {syncEar ? '켜짐' : '꺼짐'}
            </ToggleButton>
          </div>
          <button type="button" className="settings-row settings-link" onClick={() => void signOut()}>
            <span>로그아웃</span>
          </button>
          <button type="button" className="settings-row settings-link danger-text" onClick={() => void removeAccount()}>
            <span>계정 삭제</span>
          </button>
          <Help>
            로그인한 기기끼리 기기·측정치·내 타깃·비교 탭·EQ를 자동으로 맞춰요(고친 뒤 30초, 앱을 열거나 다시 볼 때). 내 귀 설정은 켰을
            때만 올라가요. 로그아웃하거나 계정을 지워도 이 기기의 데이터는 그대로예요.
          </Help>
        </div>
      )}
    </Modal>
  )
}
