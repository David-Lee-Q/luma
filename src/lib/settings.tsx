import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'luma-cloud-settings-v1'

export interface CloudSettings {
  enabled: boolean
  autoEnhance: boolean
  consentedAt: number | null
}

export interface ServiceStatus {
  configured: boolean
  reachable: boolean
  vision: string | null
  text: string | null
  embed: string | null
  rerank: string | null
}

interface SettingsContextValue {
  settings: CloudSettings
  status: ServiceStatus
  checking: boolean
  setEnabled: (enabled: boolean) => void
  setAutoEnhance: (value: boolean) => void
  refreshStatus: () => Promise<void>
}

const DEFAULT_SETTINGS: CloudSettings = {
  enabled: false,
  autoEnhance: true,
  consentedAt: null,
}

const UNKNOWN_STATUS: ServiceStatus = {
  configured: false,
  reachable: false,
  vision: null,
  text: null,
  embed: null,
  rerank: null,
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function readStored(): CloudSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<CloudSettings>
    return {
      enabled: Boolean(parsed.enabled),
      autoEnhance: parsed.autoEnhance ?? true,
      consentedAt: typeof parsed.consentedAt === 'number' ? parsed.consentedAt : null,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CloudSettings>(DEFAULT_SETTINGS)
  const [status, setStatus] = useState<ServiceStatus>(UNKNOWN_STATUS)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    setSettings(readStored())
  }, [])

  const persist = useCallback((next: CloudSettings) => {
    setSettings(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // 存储不可用时保持内存态
    }
  }, [])

  const refreshStatus = useCallback(async () => {
    setChecking(true)
    try {
      const response = await fetch('/api/health', { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error('bad status')
      const data = (await response.json()) as {
        configured?: boolean
        models?: Record<string, string>
      }
      setStatus({
        configured: Boolean(data.configured),
        reachable: true,
        vision: data.models?.vision ?? null,
        text: data.models?.text ?? null,
        embed: data.models?.embed ?? null,
        rerank: data.models?.rerank ?? null,
      })
    } catch {
      setStatus(UNKNOWN_STATUS)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const setEnabled = useCallback(
    (enabled: boolean) => {
      persist({
        ...settings,
        enabled,
        consentedAt: enabled ? Date.now() : settings.consentedAt,
      })
    },
    [persist, settings],
  )

  const setAutoEnhance = useCallback(
    (value: boolean) => {
      persist({ ...settings, autoEnhance: value })
    },
    [persist, settings],
  )

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, status, checking, setEnabled, setAutoEnhance, refreshStatus }),
    [settings, status, checking, setEnabled, setAutoEnhance, refreshStatus],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) throw new Error('useSettings must be used inside SettingsProvider')
  return context
}
