import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'arriyia-theme'
const THEME_EVENT = 'arriyia-theme-change'

function getSystemTheme(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): ThemeMode | null {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle('theme-light', mode === 'light')
  document.documentElement.classList.toggle('theme-dark', mode === 'dark')
  document.documentElement.style.colorScheme = mode
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light'
    return getStoredTheme() ?? getSystemTheme()
  })

  useEffect(() => {
    const current = getStoredTheme() ?? getSystemTheme()
    setTheme(current)
    applyTheme(current)

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleSystemChange = () => {
      if (!getStoredTheme()) {
        const next = getSystemTheme()
        setTheme(next)
        applyTheme(next)
      }
    }
    const handleThemeEvent = () => {
      const next = getStoredTheme() ?? getSystemTheme()
      setTheme(next)
      applyTheme(next)
    }

    media.addEventListener('change', handleSystemChange)
    window.addEventListener(THEME_EVENT, handleThemeEvent)

    return () => {
      media.removeEventListener('change', handleSystemChange)
      window.removeEventListener(THEME_EVENT, handleThemeEvent)
    }
  }, [])

  function setThemeMode(next: ThemeMode) {
    window.localStorage.setItem(STORAGE_KEY, next)
    setTheme(next)
    applyTheme(next)
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  function toggleTheme() {
    setThemeMode(theme === 'dark' ? 'light' : 'dark')
  }

  return { theme, setTheme: setThemeMode, toggleTheme }
}
