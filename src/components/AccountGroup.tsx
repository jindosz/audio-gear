// 설정 맨 위 "계정" 묶음: 로그인 전 [로그인 / 가입], 로그인 후 이메일·마지막 동기화·[지금 동기화]·[로그아웃]
import { useEffect, useState } from 'react'
import { loadAccount, signOutAccount, syncNow, useAccount } from '../account'
import { showToast } from '../toast'
import { SignInDialog } from './SignInDialog'

/** "방금" / "3분 전" / "2시간 전" / "11월 20일" */
function ago(t: number): string {
  const s = (Date.now() - t) / 1000
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return new Date(t).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

export function AccountGroup() {
  const account = useAccount()
  const [signingIn, setSigningIn] = useState(false)
  // 계정 칸을 열 때 서버를 불러온다(로그인한 적 없으면 앱을 열 때는 안 불러옴)
  useEffect(() => {
    void loadAccount()
  }, [])

  return (
    <section className="settings-group">
      <h3 className="settings-group-title">계정</h3>
      {!account.loaded ? (
        <p className="muted small">불러오는 중…</p>
      ) : !account.configured ? (
        <p className="muted small">아직 서버가 설정되지 않았어요</p>
      ) : !account.user ? (
        <button type="button" className="settings-row settings-link" onClick={() => setSigningIn(true)}>
          <span>로그인 / 가입</span>
          <span className="muted small">PC·폰 동기화</span>
        </button>
      ) : (
        <>
          <div className="settings-row">
            <span>
              {account.user.email}
              <span className="muted small">
                {' · '}
                {account.syncing
                  ? '동기화 중…'
                  : account.error
                    ? account.error
                    : account.lastSyncAt
                      ? `${ago(account.lastSyncAt)} 동기화`
                      : '아직 동기화 안 함'}
              </span>
            </span>
            <span className="settings-row-actions">
              <button type="button" className="small primary" disabled={account.syncing} onClick={() => void syncNow(true)}>
                지금 동기화
              </button>
              <button
                type="button"
                className="small"
                onClick={() => void signOutAccount().then(() => showToast('로그아웃했어요(이 기기 데이터는 그대로예요)'))}
              >
                로그아웃
              </button>
            </span>
          </div>
        </>
      )}
      <SignInDialog open={signingIn} onClose={() => setSigningIn(false)} />
    </section>
  )
}
