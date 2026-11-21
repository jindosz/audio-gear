// 로그인·가입 팝업: 위에서 [로그인 | 가입]을 고르고, 가입이면 비밀번호를 한 번 더 받는다. 로그인이면 "비밀번호를 잊었어요"(재설정 메일)
import { useState, type FormEvent } from 'react'
import { resetPassword, signIn, signUp } from '../account'
import { showToast } from '../toast'
import { Help } from './Help'
import { Modal } from './Modal'
import { SegmentedGroup } from './SegmentedGroup'

interface Props {
  open: boolean
  onClose: () => void
}

export function SignInDialog({ open, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true)
    setError('')
    try {
      await action()
      showToast(done)
      setPassword('')
      setConfirm('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (mode === 'signIn') {
      void run(() => signIn(email, password), '로그인했어요')
      return
    }
    if (password !== confirm) {
      setError('비밀번호가 서로 달라요')
      return
    }
    void run(() => signUp(email, password), '가입했어요')
  }

  async function forgot() {
    if (!email.trim()) {
      setError('이메일을 먼저 적어 주세요')
      return
    }
    setBusy(true)
    setError('')
    try {
      await resetPassword(email)
      showToast('비밀번호 재설정 메일을 보냈어요')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === 'signIn' ? '로그인' : '가입'}>
      <form className="sign-in" onSubmit={submit}>
        <SegmentedGroup label="로그인 또는 가입">
          {(['signIn', 'signUp'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? 'active' : undefined}
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m)
                setError('')
              }}
            >
              {m === 'signIn' ? '로그인' : '가입'}
            </button>
          ))}
        </SegmentedGroup>
        <label>
          <span className="muted small">이메일</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} data-autofocus required />
        </label>
        <label>
          <span className="muted small">비밀번호(6자 이상)</span>
          <input
            type="password"
            autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        {mode === 'signUp' && (
          <label>
            <span className="muted small">비밀번호 확인</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              required
            />
          </label>
        )}
        {error && <p className="error small">{error}</p>}
        <button type="submit" className="primary sign-in-submit" disabled={busy}>
          {busy ? '잠시만요…' : mode === 'signIn' ? '로그인' : '가입'}
        </button>
        {mode === 'signIn' && (
          <button type="button" className="link small" disabled={busy} onClick={() => void forgot()}>
            비밀번호를 잊었어요
          </button>
        )}
        <Help>
          로그인하면 기기·측정치·내 타깃·비교 탭·EQ가 PC와 폰 사이에서 맞춰져요. 로그인하지 않아도 앱은 그대로 쓸 수 있어요. 데이터는 이
          기기에 먼저 저장되고, 서버에는 내 계정만 볼 수 있게 올라가요.
        </Help>
      </form>
    </Modal>
  )
}
