import { type ReactElement, useState, useEffect, useCallback } from 'react'
import { Settings, Cpu, User, Info, Eye, EyeOff, Check, X, Loader2 } from 'lucide-react'
import type { LLMProviderType, LLMProvidersConfig } from '../../../shared/types/llm.types'
import { getProviderName, getModelsForProvider } from '../../../shared/types/llm.types'
import { useAuthStore } from '../stores'

type SettingsSection = 'general' | 'ai-providers' | 'google-account' | 'about'

interface ProviderCardState {
  apiKey: string
  showApiKey: boolean
  testing: boolean
  testResult: { success: boolean; message: string } | null
}

const sectionIcons = {
  general: Settings,
  'ai-providers': Cpu,
  'google-account': User,
  about: Info
}

const sectionLabels = {
  general: 'General',
  'ai-providers': 'AI Providers',
  'google-account': 'Google Account',
  about: 'About'
}

export function SettingsPage(): ReactElement {
  const [activeSection, setActiveSection] = useState<SettingsSection>('ai-providers')
  const [llmConfig, setLLMConfig] = useState<LLMProvidersConfig | null>(null)
  const [settings, setSettings] = useState<{
    theme: 'dark' | 'light' | 'system'
    sidebarExpanded: boolean
    autoSyncOnStart: boolean
    showSyncStatus: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)

  // Provider-specific UI state
  const [providerStates, setProviderStates] = useState<Record<LLMProviderType, ProviderCardState>>({
    openai: { apiKey: '', showApiKey: false, testing: false, testResult: null },
    anthropic: { apiKey: '', showApiKey: false, testing: false, testResult: null },
    google: { apiKey: '', showApiKey: false, testing: false, testResult: null }
  })

  const { user, logout } = useAuthStore()

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      try {
        const [llmResult, settingsResult] = await Promise.all([
          window.electronAPI.invoke<{ success: boolean; data: LLMProvidersConfig }>(
            'storage:get',
            'llmProviders'
          ),
          window.electronAPI.invoke<{
            success: boolean
            data: {
              theme: 'dark' | 'light' | 'system'
              sidebarExpanded: boolean
              autoSyncOnStart: boolean
              showSyncStatus: boolean
            }
          }>('storage:get', 'settings')
        ])

        if (llmResult.success && llmResult.data) {
          setLLMConfig(llmResult.data)
          // Initialize provider states with existing API keys (masked)
          setProviderStates({
            openai: {
              apiKey: llmResult.data.openai.apiKey ? '••••••••••••••••' : '',
              showApiKey: false,
              testing: false,
              testResult: null
            },
            anthropic: {
              apiKey: llmResult.data.anthropic.apiKey ? '••••••••••••••••' : '',
              showApiKey: false,
              testing: false,
              testResult: null
            },
            google: {
              apiKey: llmResult.data.google.apiKey ? '••••••••••••••••' : '',
              showApiKey: false,
              testing: false,
              testResult: null
            }
          })
        }

        if (settingsResult.success && settingsResult.data) {
          setSettings(settingsResult.data)
        }
      } catch (error) {
        console.error('Failed to load settings:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [])

  const updateProviderState = useCallback(
    (provider: LLMProviderType, updates: Partial<ProviderCardState>) => {
      setProviderStates((prev) => ({
        ...prev,
        [provider]: { ...prev[provider], ...updates }
      }))
    },
    []
  )

  const handleApiKeyChange = useCallback(
    (provider: LLMProviderType, value: string) => {
      updateProviderState(provider, { apiKey: value, testResult: null })
    },
    [updateProviderState]
  )

  const handleSaveApiKey = useCallback(
    async (provider: LLMProviderType) => {
      const state = providerStates[provider]
      // Don't save if it's the masked placeholder
      if (state.apiKey === '••••••••••••••••') return

      try {
        await window.electronAPI.invoke(
          'storage:setLLMApiKey',
          provider,
          state.apiKey || null
        )

        // Update local config
        setLLMConfig((prev) =>
          prev
            ? {
                ...prev,
                [provider]: { ...prev[provider], apiKey: state.apiKey || null }
              }
            : null
        )

        // Mask the API key after saving
        if (state.apiKey) {
          updateProviderState(provider, { apiKey: '••••••••••••••••', showApiKey: false })
        }
      } catch (error) {
        console.error('Failed to save API key:', error)
      }
    },
    [providerStates, updateProviderState]
  )

  const handleTestConnection = useCallback(
    async (provider: LLMProviderType) => {
      // Save API key first if changed
      const state = providerStates[provider]
      if (state.apiKey && state.apiKey !== '••••••••••••••••') {
        await handleSaveApiKey(provider)
      }

      updateProviderState(provider, { testing: true, testResult: null })

      try {
        const result = await window.electronAPI.invoke<{
          success: boolean
          data?: { success: boolean; latencyMs?: number; error?: string }
          error?: string
        }>('llm:testConnection', provider)

        if (result.success && result.data) {
          updateProviderState(provider, {
            testing: false,
            testResult: {
              success: result.data.success,
              message: result.data.success
                ? `Connected (${result.data.latencyMs}ms)`
                : result.data.error || 'Connection failed'
            }
          })
        } else {
          updateProviderState(provider, {
            testing: false,
            testResult: {
              success: false,
              message: result.error || 'Connection failed'
            }
          })
        }
      } catch (error) {
        updateProviderState(provider, {
          testing: false,
          testResult: {
            success: false,
            message: error instanceof Error ? error.message : 'Connection failed'
          }
        })
      }
    },
    [providerStates, handleSaveApiKey, updateProviderState]
  )

  const handleModelChange = useCallback(
    async (provider: LLMProviderType, model: string) => {
      try {
        await window.electronAPI.invoke('storage:setLLMModel', provider, model)
        setLLMConfig((prev) =>
          prev
            ? {
                ...prev,
                [provider]: { ...prev[provider], model }
              }
            : null
        )
      } catch (error) {
        console.error('Failed to save model:', error)
      }
    },
    []
  )

  const handleSetDefault = useCallback(async (provider: LLMProviderType) => {
    try {
      await window.electronAPI.invoke('storage:setDefaultLLMProvider', provider)
      setLLMConfig((prev) => (prev ? { ...prev, default: provider } : null))
    } catch (error) {
      console.error('Failed to set default provider:', error)
    }
  }, [])

  const handleTemperatureChange = useCallback(async (temperature: number) => {
    try {
      await window.electronAPI.invoke('storage:setLLMTemperature', temperature)
      setLLMConfig((prev) => (prev ? { ...prev, temperature } : null))
    } catch (error) {
      console.error('Failed to save temperature:', error)
    }
  }, [])

  const handleThemeChange = useCallback(async (theme: 'dark' | 'light' | 'system') => {
    try {
      await window.electronAPI.invoke('storage:set', 'settings', { theme })
      setSettings((prev) => (prev ? { ...prev, theme } : null))

      // Apply theme to document
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
      } else {
        document.documentElement.setAttribute('data-theme', theme)
      }
    } catch (error) {
      console.error('Failed to save theme:', error)
    }
  }, [])

  const renderSidebar = (): ReactElement => (
    <div className="w-48 shrink-0 border-r border-[var(--color-border)] pr-4">
      <nav className="space-y-1">
        {(Object.keys(sectionLabels) as SettingsSection[]).map((section) => {
          const Icon = sectionIcons[section]
          const isActive = activeSection === section

          return (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                isActive
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
              }`}
            >
              <Icon size={18} />
              {sectionLabels[section]}
            </button>
          )
        })}
      </nav>
    </div>
  )

  const renderProviderCard = (provider: LLMProviderType): ReactElement => {
    const config = llmConfig?.[provider]
    const state = providerStates[provider]
    const models = getModelsForProvider(provider)
    const isDefault = llmConfig?.default === provider
    const hasApiKey = config?.apiKey !== null

    return (
      <div
        key={provider}
        className={`p-4 rounded-lg border ${
          isDefault
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
            : 'border-[var(--color-border)] bg-[var(--color-surface)]'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-[var(--color-text-primary)]">
              {getProviderName(provider)}
            </h3>
            {isDefault && (
              <span className="px-2 py-0.5 text-xs rounded bg-[var(--color-accent)] text-white">
                Default
              </span>
            )}
          </div>
          {!isDefault && hasApiKey && (
            <button
              onClick={() => handleSetDefault(provider)}
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              Set as default
            </button>
          )}
        </div>

        {/* API Key Input */}
        <div className="mb-4">
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
            API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={state.showApiKey ? 'text' : 'password'}
                value={state.apiKey}
                onChange={(e) => handleApiKeyChange(provider, e.target.value)}
                onBlur={() => handleSaveApiKey(provider)}
                placeholder={`Enter ${getProviderName(provider)} API key`}
                className="w-full px-3 py-2 pr-10 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
              />
              <button
                type="button"
                onClick={() => updateProviderState(provider, { showApiKey: !state.showApiKey })}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              >
                {state.showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <button
              onClick={() => handleTestConnection(provider)}
              disabled={state.testing || !hasApiKey}
              className="px-3 py-2 rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] text-sm hover:bg-[var(--color-surface-active)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {state.testing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                'Test'
              )}
            </button>
          </div>

          {/* Test Result */}
          {state.testResult && (
            <div
              className={`flex items-center gap-2 mt-2 text-sm ${
                state.testResult.success
                  ? 'text-[var(--color-success)]'
                  : 'text-[var(--color-error)]'
              }`}
            >
              {state.testResult.success ? <Check size={14} /> : <X size={14} />}
              {state.testResult.message}
            </div>
          )}
        </div>

        {/* Model Selection */}
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">
            Model
          </label>
          <select
            value={config?.model || models[0]?.id}
            onChange={(e) => handleModelChange(provider, e.target.value)}
            disabled={!hasApiKey}
            className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          {hasApiKey && config?.model && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {models.find((m) => m.id === config.model)?.description}
            </p>
          )}
        </div>
      </div>
    )
  }

  const renderAIProvidersSection = (): ReactElement => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">
          AI Providers
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Configure API keys for AI-powered features like question generation and lesson planning.
        </p>
      </div>

      {/* Provider Cards */}
      <div className="space-y-4">
        {renderProviderCard('openai')}
        {renderProviderCard('anthropic')}
        {renderProviderCard('google')}
      </div>

      {/* Temperature Setting */}
      <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-[var(--color-text-primary)]">
            Temperature
          </label>
          <span className="text-sm text-[var(--color-text-muted)]">
            {llmConfig?.temperature.toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={llmConfig?.temperature ?? 0.7}
          onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--color-bg-secondary)]"
        />
        <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
          <span>Precise</span>
          <span>Creative</span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          Lower values produce more focused, deterministic responses. Higher values increase creativity and variation.
        </p>
      </div>
    </div>
  )

  const renderGeneralSection = (): ReactElement => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">General</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Configure application appearance and behavior.
        </p>
      </div>

      {/* Theme */}
      <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <h3 className="font-medium text-[var(--color-text-primary)] mb-3">Appearance</h3>
        <div className="space-y-2">
          <label className="block text-sm text-[var(--color-text-secondary)] mb-2">Theme</label>
          <div className="flex gap-2">
            {(['dark', 'light', 'system'] as const).map((theme) => (
              <button
                key={theme}
                onClick={() => handleThemeChange(theme)}
                className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
                  settings?.theme === theme
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-active)]'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sync Settings */}
      <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <h3 className="font-medium text-[var(--color-text-primary)] mb-3">Sync</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings?.autoSyncOnStart ?? true}
              onChange={(e) => {
                window.electronAPI.invoke('storage:set', 'settings', {
                  autoSyncOnStart: e.target.checked
                })
                setSettings((prev) =>
                  prev ? { ...prev, autoSyncOnStart: e.target.checked } : null
                )
              }}
              className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            />
            <span className="text-sm text-[var(--color-text-secondary)]">
              Auto-sync on app start
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings?.showSyncStatus ?? true}
              onChange={(e) => {
                window.electronAPI.invoke('storage:set', 'settings', {
                  showSyncStatus: e.target.checked
                })
                setSettings((prev) =>
                  prev ? { ...prev, showSyncStatus: e.target.checked } : null
                )
              }}
              className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
            />
            <span className="text-sm text-[var(--color-text-secondary)]">
              Show sync status indicator
            </span>
          </label>
        </div>
      </div>
    </div>
  )

  const renderGoogleAccountSection = (): ReactElement => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">
          Google Account
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Manage your connected Google account for Drive storage.
        </p>
      </div>

      <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        {user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {user.picture && (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">{user.name}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{user.email}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-[var(--color-border)]">
              <button
                onClick={logout}
                className="px-4 py-2 rounded-lg bg-[var(--color-error)]/10 text-[var(--color-error)] text-sm hover:bg-[var(--color-error)]/20 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-[var(--color-text-muted)] mb-4">No account connected</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Sign in from the Dashboard to connect your Google account.
            </p>
          </div>
        )}
      </div>
    </div>
  )

  const renderAboutSection = (): ReactElement => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">About</h2>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Information about TeachingHelp.
        </p>
      </div>

      <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-[var(--color-text-primary)]">TeachingHelp</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">Version 0.1.0</p>
          </div>
        </div>

        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          An AI-powered desktop application designed to help teachers create lesson plans,
          generate tests, and grade assessments efficiently.
        </p>

        <div className="space-y-2 text-sm text-[var(--color-text-muted)]">
          <p>Built with Electron, React, and TypeScript</p>
          <p>Platform: {window.electronAPI.platform}</p>
        </div>
      </div>
    </div>
  )

  const renderContent = (): ReactElement => {
    switch (activeSection) {
      case 'general':
        return renderGeneralSection()
      case 'ai-providers':
        return renderAIProvidersSection()
      case 'google-account':
        return renderGoogleAccountSection()
      case 'about':
        return renderAboutSection()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--color-text-muted)]">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Settings</h1>

      <div className="flex gap-6">
        {renderSidebar()}
        <div className="flex-1 min-w-0">{renderContent()}</div>
      </div>
    </div>
  )
}
