import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
const STORAGE_KEY = 'arriyia-theme'

interface ThemeContextValue {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
  cycleTheme: () => void
}
const ThemeContext = createContext<ThemeContextValue | null>(null)

function readTheme(): ThemePreference {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => readTheme())

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try { window.localStorage.setItem(STORAGE_KEY, theme) } catch {}
  }, [theme])

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme: setThemeState,
    cycleTheme: () => setThemeState((current) => current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system'),
  }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used within ThemeProvider')
  return value
}
