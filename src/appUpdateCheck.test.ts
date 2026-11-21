// appUpdateCheck.ts 테스트(앱 업데이트 찾기). 실행: npm test
import { describe, expect, it } from 'vitest'
import { CHECK_INTERVAL_MS, apkBuildNumber, findUpdate, shouldCheck } from './appUpdateCheck'

const asset = (name: string) => ({ name, browser_download_url: `https://example.com/${name}` })

describe('apkBuildNumber', () => {
  it('파일 이름에서 빌드 번호를 읽는다', () => {
    expect(apkBuildNumber('audio-gear-0.1.35.apk')).toBe(35)
    expect(apkBuildNumber('audio-gear-0.1.7.apk')).toBe(7)
  })
  it('형식이 다르면 null', () => {
    expect(apkBuildNumber('audio-gear-0.1.35.aab')).toBeNull()
    expect(apkBuildNumber('other.apk')).toBeNull()
  })
})

describe('findUpdate', () => {
  it('지금보다 새 빌드가 있으면 그것', () => {
    expect(findUpdate({ assets: [asset('audio-gear-0.1.35.apk')] }, 30)).toEqual({
      build: 35,
      url: 'https://example.com/audio-gear-0.1.35.apk',
      fileName: 'audio-gear-0.1.35.apk',
    })
  })
  it('같거나 오래된 빌드면 없음(미리 보기로 더 새 빌드를 깔아 둔 경우 포함)', () => {
    expect(findUpdate({ assets: [asset('audio-gear-0.1.35.apk')] }, 35)).toBeNull()
    expect(findUpdate({ assets: [asset('audio-gear-0.1.35.apk')] }, 36)).toBeNull()
  })
  it('여럿이면 가장 새것, 다른 파일은 무시', () => {
    const release = { assets: [asset('audio-gear-0.1.33.apk'), asset('notes.txt'), asset('audio-gear-0.1.35.apk')] }
    expect(findUpdate(release, 30)?.build).toBe(35)
  })
})

describe('shouldCheck', () => {
  it('처음이거나 강제면 확인', () => {
    expect(shouldCheck(null, 1000, false)).toBe(true)
    expect(shouldCheck(1000, 1001, true)).toBe(true)
  })
  it('6시간 안이면 건너뛰고, 지나면 확인', () => {
    expect(shouldCheck(0, CHECK_INTERVAL_MS - 1, false)).toBe(false)
    expect(shouldCheck(0, CHECK_INTERVAL_MS, false)).toBe(true)
  })
})
