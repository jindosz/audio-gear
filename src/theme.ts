// 화면 테마(라이트/다크) 설정.
// - 'system': 운영체제 설정을 따른다(기본값)
// - 'light' / 'dark': 사용자가 고른 테마로 고정
// 고른 값은 이 브라우저의 localStorage에 둔다(기기마다 달라도 되는 화면 설정이라서).
// 실제 색 전환은 <html data-theme="dark">처럼 속성을 붙이면 index.css가 처리한다.
import { useSyncExternalStore } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'audio-gear.theme'
const darkQuery = matchMedia('(prefers-color-scheme: dark)')

export function getThemePref(): ThemePref {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark') return value
  } catch {
    // localStorage가 막혀 있으면 시스템 설정을 따른다
  }
  return 'system'
}

/** <html>에 data-theme 속성을 붙이거나 뗀다 */
export function applyTheme(pref: ThemePref) {
  if (pref === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = pref
}

// 테마가 바뀌었을 때 알려줄 함수들(그래프처럼 색을 직접 읽는 화면이 다시 그리도록)
const listeners = new Set<() => void>()

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // 저장 못 해도 지금 화면에는 적용한다(다음 실행 때는 시스템 설정으로 돌아감)
  }
  applyTheme(pref)
  listeners.forEach((notify) => notify())
}

/** 지금 실제로 보이는 테마. 'system'이면 운영체제 설정에 따라 정해진다 */
export function resolvedTheme(): 'light' | 'dark' {
  const pref = getThemePref()
  if (pref !== 'system') return pref
  return darkQuery.matches ? 'dark' : 'light'
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  darkQuery.addEventListener('change', onChange) // 운영체제 설정이 바뀔 때도 알린다
  return () => {
    listeners.delete(onChange)
    darkQuery.removeEventListener('change', onChange)
  }
}

// useSyncExternalStore: React 바깥에 있는 값(localStorage, 운영체제 설정)을 구독해서,
// 값이 바뀌면 이 훅을 쓰는 컴포넌트를 다시 그리게 해 주는 React 기본 훅
export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, getThemePref)
}

export function useResolvedTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribe, resolvedTheme)
}
