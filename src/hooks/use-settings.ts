import { useEffect, useState } from 'react'

export type Theme = 'system' | 'dark' | 'light'
export type Settings = { theme: Theme }

const STORAGE_KEY = 'settings'
const DEFAULT_SETTINGS: Settings = { theme: 'system' }

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // ignore malformed JSON
  }
  return DEFAULT_SETTINGS
}

export function useSettings() {
  const [settings, setSettings] = useState(loadSettings)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  }, [settings])

  return [settings, setSettings] as const
}
