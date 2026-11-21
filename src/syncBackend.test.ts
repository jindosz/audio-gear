// syncBackend.ts·memoryBackend.ts 테스트(서버 창구의 약속). 실행: npm test
import { describe, expect, it } from 'vitest'
import { createMemoryBackend } from './memoryBackend'
import { authErrorText } from './syncBackend'

describe('memoryBackend', () => {
  it('가입 → 로그인 상태 알림', async () => {
    const b = createMemoryBackend()
    const seen: (string | null)[] = []
    b.onUser((u) => seen.push(u?.email ?? null))
    await b.signUp('a@test.com', 'secret1')
    expect(seen.at(-1)).toBe('a@test.com')
    await b.signOut()
    expect(seen.at(-1)).toBeNull()
  })
  it('비밀번호가 틀리면 오류', async () => {
    const b = createMemoryBackend()
    await b.signUp('a@test.com', 'secret1')
    await b.signOut()
    await expect(b.signIn('a@test.com', 'nope')).rejects.toMatchObject({ code: 'auth/invalid-credential' })
  })
  it('올린 것은 받을 때 나오고, since 이후 것만', async () => {
    const b = createMemoryBackend()
    await b.push('u1', 'devices', [
      { id: 'a', updatedAt: 10, data: { id: 'a' } },
      { id: 'b', updatedAt: 20, deleted: true },
    ])
    expect((await b.pullSince('u1', 'devices', 0)).map((d) => d.id).sort()).toEqual(['a', 'b'])
    expect((await b.pullSince('u1', 'devices', 10)).map((d) => d.id)).toEqual(['b'])
  })
  it('다른 사람 데이터는 안 보임', async () => {
    const b = createMemoryBackend()
    await b.push('u1', 'devices', [{ id: 'a', updatedAt: 10, data: {} }])
    expect(await b.pullSince('u2', 'devices', 0)).toEqual([])
  })
  it('같은 id를 다시 올리면 덮어씀', async () => {
    const b = createMemoryBackend()
    await b.push('u1', 'eqPresets', [{ id: 'a', updatedAt: 10, data: { name: '1' } }])
    await b.push('u1', 'eqPresets', [{ id: 'a', updatedAt: 20, data: { name: '2' } }])
    const docs = await b.pullSince('u1', 'eqPresets', 0)
    expect(docs).toHaveLength(1)
    expect(docs[0].data?.name).toBe('2')
  })
  it('내 데이터 모두 지우기', async () => {
    const b = createMemoryBackend()
    await b.push('u1', 'devices', [{ id: 'a', updatedAt: 10, data: {} }])
    await b.deleteAllData('u1')
    expect(await b.pullSince('u1', 'devices', 0)).toEqual([])
  })
})

describe('authErrorText', () => {
  it('Firebase 오류 코드 → 한국어', () => {
    expect(authErrorText('auth/invalid-credential')).toBe('이메일이나 비밀번호가 맞지 않아요')
    expect(authErrorText('auth/wrong-password')).toBe('이메일이나 비밀번호가 맞지 않아요')
    expect(authErrorText('auth/email-already-in-use')).toBe('이미 가입된 이메일이에요')
    expect(authErrorText('auth/weak-password')).toBe('비밀번호는 6자 이상이어야 해요')
    expect(authErrorText('auth/invalid-email')).toBe('이메일 형식이 맞지 않아요')
    expect(authErrorText('auth/network-request-failed')).toBe('인터넷에 연결되어 있지 않아요')
    expect(authErrorText('auth/too-many-requests')).toBe('시도가 너무 많아요. 잠시 뒤 다시 해 주세요')
    expect(authErrorText('auth/requires-recent-login')).toBe('보안을 위해 다시 로그인한 뒤 해 주세요')
    expect(authErrorText('something')).toBe('로그인하지 못했어요')
  })
})
