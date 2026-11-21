// 로그인·가입 팝업: 이메일·비밀번호, [로그인]·[가입], "비밀번호를 잊었어요"(재설정 메일)
import { useState, type FormEvent } from 'react'
import { resetPassword, signIn, signUp } from '../account'
import { showToast } from '../toast'
import { Help } from './Help'
import { Modal } from './Modal'

interface Props {
  open: boolean
  onClose: () => void
}

export function SignInDialog({ open, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true)
    setError('')
    try {
      await action()
      showToast(done)
      setPassword('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void run(() => signIn(email, password), '로그인했어요')
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
    <Modal open={open} onClose={onClose} title="로그인">
      <form className="sign-in" onSubmit={submit}>
        <label>
          <span className="muted small">이메일</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} data-autofocus required />
        </label>
        <label>
          <span className="muted small">비밀번호(6자 이상)</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>
        {error && <p className="error small">{error}</p>}
        <div className="ear-balance-actions">
          <button type="button" disabled={busy} onClick={() => void run(() => signUp(email, password), '가입했어요')}>
            가입
          </button>
          <button type="submit" className="primary" disabled={busy}>
            로그인
          </button>
        </div>
        <button type="button" className="link small" disabled={busy} onClick={() => void forgot()}>
          비밀번호를 잊었어요
        </button>
        <Help>
          로그인하면 기기·측정치·내 타깃·비교 탭·EQ가 PC와 폰 사이에서 맞춰져요. 로그인하지 않아도 앱은 그대로 쓸 수 있어요. 데이터는 이
          기기에 먼저 저장되고, 서버에는 내 계정만 볼 수 있게 올라가요.
        </Help>
      </form>
    </Modal>
  )
}
