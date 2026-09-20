import { useEffect, useState } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'arriyia-theme'
const THEME_EVENT = 'arriyia-theme-change'

function getSystemTheme(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): ThemePreference {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

function resolveTheme(preference: ThemePreference): ThemeMode {
  return preference === 'system' ? getSystemTheme() : preference
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle('theme-light', mode === 'light')
  document.documentElement.classList.toggle('theme-dark', mode === 'dark')
  document.documentElement.style.colorScheme = mode
}

export function initializeTheme() {
  if (typeof window === 'undefined') return
  applyTheme(resolveTheme(getStoredTheme()))
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'system'
    return getStoredTheme()
  })
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light'
    return resolveTheme(getStoredTheme())
  })

  useEffect(() => {
    const currentPreference = getStoredTheme()
    const currentTheme = resolveTheme(currentPreference)
    setPreference(currentPreference)
    setTheme(currentTheme)
    applyTheme(currentTheme)

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemChange = () => {
      if (getStoredTheme() === 'system') {
        const next = getSystemTheme()
        setTheme(next)
        applyTheme(next)
      }
    }
    const handleThemeEvent = () => {
      const nextPreference = getStoredTheme()
      const nextTheme = resolveTheme(nextPreference)
      setPreference(nextPreference)
      setTheme(nextTheme)
      applyTheme(nextTheme)
    }

    media.addEventListener('change', handleSystemChange)
    window.addEventListener(THEME_EVENT, handleThemeEvent)

    return () => {
      media.removeEventListener('change', handleSystemChange)
      window.removeEventListener(THEME_EVENT, handleThemeEvent)
    }
  }, [])

  function setThemePreference(next: ThemePreference) {
    window.localStorage.setItem(STORAGE_KEY, next)
    const nextTheme = resolveTheme(next)
    setPreference(next)
    setTheme(nextTheme)
    applyTheme(nextTheme)
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  return { theme, preference, setTheme: setThemePreference }
}
