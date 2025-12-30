import { type ReactElement, useState, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Paper from '@mui/material/Paper'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Slider from '@mui/material/Slider'
import Avatar from '@mui/material/Avatar'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import SettingsIcon from '@mui/icons-material/Settings'
import MemoryIcon from '@mui/icons-material/Memory'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import PersonIcon from '@mui/icons-material/Person'
import InfoIcon from '@mui/icons-material/Info'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import type { LLMProviderType, LLMProvidersConfig } from '../../../shared/types/llm.types'
import { getProviderName, getModelsForProvider } from '../../../shared/types/llm.types'
import { useAuthStore } from '../stores'
import { APIKeyHelpModal } from '../components/settings'

type SettingsSection = 'general' | 'ai-generation' | 'ai-providers' | 'google-account' | 'about'

interface ProviderCardState {
  apiKey: string
  showApiKey: boolean
  testing: boolean
  testResult: { success: boolean; message: string } | null
}

const sectionIcons = {
  general: SettingsIcon,
  'ai-generation': AutoAwesomeIcon,
  'ai-providers': MemoryIcon,
  'google-account': PersonIcon,
  about: InfoIcon
}

const sectionLabels = {
  general: 'General',
  'ai-generation': 'AI Generation',
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
    aiPromptSupplement: string
  } | null>(null)
  const [loading, setLoading] = useState(true)

  // Provider-specific UI state
  const [providerStates, setProviderStates] = useState<Record<LLMProviderType, ProviderCardState>>({
    openai: { apiKey: '', showApiKey: false, testing: false, testResult: null },
    anthropic: { apiKey: '', showApiKey: false, testing: false, testResult: null },
    google: { apiKey: '', showApiKey: false, testing: false, testResult: null }
  })

  // Help modal state
  const [helpProvider, setHelpProvider] = useState<LLMProviderType | null>(null)

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
              aiPromptSupplement: string
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
    <Box sx={{ width: 200, flexShrink: 0, borderRight: 1, borderColor: 'divider', pr: 2 }}>
      <List disablePadding>
        {(Object.keys(sectionLabels) as SettingsSection[]).map((section) => {
          const Icon = sectionIcons[section]
          const isActive = activeSection === section

          return (
            <ListItemButton
              key={section}
              selected={isActive}
              onClick={() => setActiveSection(section)}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    bgcolor: 'primary.dark'
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'inherit'
                  }
                }
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={sectionLabels[section]}
                primaryTypographyProps={{ variant: 'body2' }}
              />
            </ListItemButton>
          )
        })}
      </List>
    </Box>
  )

  const renderProviderCard = (provider: LLMProviderType): ReactElement => {
    const config = llmConfig?.[provider]
    const state = providerStates[provider]
    const models = getModelsForProvider(provider)
    const isDefault = llmConfig?.default === provider
    const hasApiKey = config?.apiKey !== null

    return (
      <Paper
        key={provider}
        variant="outlined"
        sx={{
          p: 2.5,
          borderColor: isDefault ? 'primary.main' : 'divider',
          bgcolor: isDefault ? 'primary.main' : 'background.paper',
          ...(isDefault && { bgcolor: (theme) => `${theme.palette.primary.main}10` })
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography fontWeight={600}>{getProviderName(provider)}</Typography>
            {isDefault && (
              <Chip label="Default" size="small" color="primary" />
            )}
          </Box>
          {!isDefault && hasApiKey && (
            <Button
              size="small"
              onClick={() => handleSetDefault(provider)}
              sx={{ textTransform: 'none' }}
            >
              Set as default
            </Button>
          )}
        </Box>

        {/* API Key Input */}
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              API Key
            </Typography>
            <IconButton
              size="small"
              onClick={() => setHelpProvider(provider)}
              sx={{ p: 0.25 }}
              title={`How to get a ${getProviderName(provider)} API key`}
            >
              <HelpOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              type={state.showApiKey ? 'text' : 'password'}
              value={state.apiKey}
              onChange={(e) => handleApiKeyChange(provider, e.target.value)}
              onBlur={() => handleSaveApiKey(provider)}
              placeholder={`Enter ${getProviderName(provider)} API key`}
              size="small"
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => updateProviderState(provider, { showApiKey: !state.showApiKey })}
                        edge="end"
                      >
                        {state.showApiKey ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  )
                }
              }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleTestConnection(provider)}
              disabled={state.testing || !hasApiKey}
              sx={{ minWidth: 70 }}
            >
              {state.testing ? <CircularProgress size={16} /> : 'Test'}
            </Button>
          </Box>

          {/* Test Result */}
          {state.testResult && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mt: 1,
                color: state.testResult.success ? 'success.main' : 'error.main'
              }}
            >
              {state.testResult.success ? <CheckIcon sx={{ fontSize: 16 }} /> : <CloseIcon sx={{ fontSize: 16 }} />}
              <Typography variant="body2">{state.testResult.message}</Typography>
            </Box>
          )}
        </Box>

        {/* Model Selection */}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Model
          </Typography>
          <FormControl fullWidth size="small" disabled={!hasApiKey}>
            <Select
              value={config?.model || models[0]?.id || ''}
              onChange={(e) => handleModelChange(provider, e.target.value)}
            >
              {models.map((model) => (
                <MenuItem key={model.id} value={model.id}>
                  {model.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {hasApiKey && config?.model && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {models.find((m) => m.id === config.model)?.description}
            </Typography>
          )}
        </Box>
      </Paper>
    )
  }

  const renderAIProvidersSection = (): ReactElement => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          AI Providers
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure API keys for AI-powered features like question generation and lesson planning.
        </Typography>
      </Box>

      {/* Provider Cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {renderProviderCard('openai')}
        {renderProviderCard('anthropic')}
        {renderProviderCard('google')}
      </Box>

      {/* Temperature Setting */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" fontWeight={500}>
            Temperature
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {llmConfig?.temperature.toFixed(1)}
          </Typography>
        </Box>
        <Slider
          min={0}
          max={2}
          step={0.1}
          value={llmConfig?.temperature ?? 0.7}
          onChange={(_, value) => handleTemperatureChange(value as number)}
          size="small"
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">Precise</Typography>
          <Typography variant="caption" color="text.secondary">Creative</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Lower values produce more focused, deterministic responses. Higher values increase creativity and variation.
        </Typography>
      </Paper>
    </Box>
  )

  const renderGeneralSection = (): ReactElement => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          General
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure application appearance and behavior.
        </Typography>
      </Box>

      {/* Theme */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography fontWeight={500} gutterBottom>Appearance</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Theme
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {(['dark', 'light', 'system'] as const).map((theme) => (
            <Button
              key={theme}
              variant={settings?.theme === theme ? 'contained' : 'outlined'}
              size="small"
              onClick={() => handleThemeChange(theme)}
              sx={{ textTransform: 'capitalize' }}
            >
              {theme}
            </Button>
          ))}
        </Box>
      </Paper>

      {/* Sync Settings */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography fontWeight={500} gutterBottom>Sync</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={settings?.autoSyncOnStart ?? true}
                onChange={(e) => {
                  window.electronAPI.invoke('storage:set', 'settings', {
                    autoSyncOnStart: e.target.checked
                  })
                  setSettings((prev) =>
                    prev ? { ...prev, autoSyncOnStart: e.target.checked } : null
                  )
                }}
                size="small"
              />
            }
            label={<Typography variant="body2">Auto-sync on app start</Typography>}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={settings?.showSyncStatus ?? true}
                onChange={(e) => {
                  window.electronAPI.invoke('storage:set', 'settings', {
                    showSyncStatus: e.target.checked
                  })
                  setSettings((prev) =>
                    prev ? { ...prev, showSyncStatus: e.target.checked } : null
                  )
                }}
                size="small"
              />
            }
            label={<Typography variant="body2">Show sync status indicator</Typography>}
          />
        </Box>
      </Paper>
    </Box>
  )

  const handleAIPromptSupplementChange = useCallback(
    async (value: string) => {
      // Update local state immediately for responsiveness
      setSettings((prev) => (prev ? { ...prev, aiPromptSupplement: value } : null))
    },
    []
  )

  const handleAIPromptSupplementSave = useCallback(async () => {
    if (!settings) return
    try {
      await window.electronAPI.invoke('storage:set', 'settings', {
        aiPromptSupplement: settings.aiPromptSupplement
      })
    } catch (error) {
      console.error('Failed to save AI prompt supplement:', error)
    }
  }, [settings])

  const renderAIGenerationSection = (): ReactElement => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          AI Generation
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Configure default instructions for AI-powered question generation.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography fontWeight={500} gutterBottom>
          Global Prompt Supplement
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          These instructions will be included in ALL AI-generated questions across the entire app.
          Use this for general preferences that apply to every assessment.
        </Typography>
        <TextField
          multiline
          rows={4}
          fullWidth
          placeholder="e.g., Always use simple vocabulary appropriate for English language learners. Avoid culturally specific references."
          value={settings?.aiPromptSupplement ?? ''}
          onChange={(e) => handleAIPromptSupplementChange(e.target.value)}
          onBlur={handleAIPromptSupplementSave}
          slotProps={{
            input: {
              sx: { fontSize: '0.875rem' }
            }
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Changes are saved automatically
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {settings?.aiPromptSupplement?.length ?? 0}/1000
          </Typography>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, bgcolor: 'action.hover' }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Tip:</strong> You can also set course-specific instructions on each course&apos;s settings page.
          The instruction hierarchy is: Global (this setting) → Course → Individual generation request.
        </Typography>
      </Paper>
    </Box>
  )

  const renderGoogleAccountSection = (): ReactElement => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Google Account
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage your connected Google account for Drive storage.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        {user ? (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              {user.picture && (
                <Avatar src={user.picture} alt={user.name} sx={{ width: 48, height: 48 }} />
              )}
              <Box>
                <Typography fontWeight={500}>{user.name}</Typography>
                <Typography variant="body2" color="text.secondary">{user.email}</Typography>
              </Box>
            </Box>
            <Divider sx={{ my: 2 }} />
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={logout}
            >
              Sign out
            </Button>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography color="text.secondary" gutterBottom>No account connected</Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in from the Dashboard to connect your Google account.
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  )

  const renderAboutSection = (): ReactElement => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          About
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Information about AsioGrade.
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <MenuBookIcon sx={{ fontSize: 28, color: 'primary.contrastText' }} />
          </Box>
          <Box>
            <Typography fontWeight={600}>AsioGrade</Typography>
            <Typography variant="body2" color="text.secondary">Version 0.1.0</Typography>
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Create, print, and grade assessments with ease.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            Built with Electron, React, and TypeScript
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Platform: {window.electronAPI.platform}
          </Typography>
        </Box>
      </Paper>
    </Box>
  )

  const renderContent = (): ReactElement => {
    switch (activeSection) {
      case 'general':
        return renderGeneralSection()
      case 'ai-generation':
        return renderAIGenerationSection()
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography color="text.secondary">Loading settings...</Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Box sx={{ display: 'flex', gap: 3 }}>
        {renderSidebar()}
        <Box sx={{ flex: 1, minWidth: 0 }}>{renderContent()}</Box>
      </Box>

      {/* API Key Help Modal */}
      {helpProvider && (
        <APIKeyHelpModal
          isOpen={!!helpProvider}
          onClose={() => setHelpProvider(null)}
          provider={helpProvider}
        />
      )}
    </Box>
  )
}
