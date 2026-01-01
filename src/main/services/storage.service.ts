import Store from 'electron-store'

// User info from Google OAuth
export interface UserInfo {
  id: string
  email: string
  name: string
  picture?: string
}

// OAuth tokens
export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number // Unix timestamp in milliseconds
  scope: string[]
}

// Schema for type-safe storage
interface StoreSchema {
  // Settings
  settings: {
    theme: 'dark' | 'light' | 'system'
    sidebarExpanded: boolean
    autoSyncOnStart: boolean
    showSyncStatus: boolean
    aiPromptSupplement: string // Global AI prompt supplement for all question generation
  }

  // OAuth authentication (encrypted storage)
  auth: {
    tokens: OAuthTokens | null
    user: UserInfo | null
  }

  // LLM provider configuration
  llmProviders: {
    default: 'openai' | 'anthropic' | 'google' | null
    openai: {
      apiKey: string | null
      model: string
    }
    anthropic: {
      apiKey: string | null
      model: string
    }
    google: {
      apiKey: string | null
      model: string
    }
    temperature: number
  }

  // Cache metadata
  cacheMetadata: Record<
    string,
    {
      version: number
      lastModified: string
      lastSynced: string
    }
  >

  // Test drafts (local only until published)
  drafts: Record<
    string,
    {
      id: string
      classId: string
      name: string
      lastModified: string
      content: unknown // Test content
    }
  >

  // Recent classes for quick access
  recentClasses: string[]

  // Window state
  windowState: {
    width: number
    height: number
    x?: number
    y?: number
    isMaximized: boolean
  }

  // Last directory used for file saves/exports
  lastSaveDirectory: string | null
}

// Default values
const defaults: StoreSchema = {
  settings: {
    theme: 'dark',
    sidebarExpanded: true,
    autoSyncOnStart: true,
    showSyncStatus: true,
    aiPromptSupplement: ''
  },
  auth: {
    tokens: null,
    user: null
  },
  llmProviders: {
    default: null,
    openai: {
      apiKey: null,
      model: 'gpt-4.1'
    },
    anthropic: {
      apiKey: null,
      model: 'claude-3-5-sonnet-20241022'
    },
    google: {
      apiKey: null,
      model: 'gemini-2.5-flash'
    },
    temperature: 0.7
  },
  cacheMetadata: {},
  drafts: {},
  recentClasses: [],
  windowState: {
    width: 1200,
    height: 800,
    isMaximized: false
  },
  lastSaveDirectory: null
}

class StorageService {
  private store: Store<StoreSchema>

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'teachinghelp-storage',
      defaults,
      encryptionKey: 'teachinghelp-secure-storage-key' // For basic encryption
    })
  }

  // Generic get/set for any key
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
    return this.store.get(key)
  }

  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    this.store.set(key, value)
  }

  // Settings helpers
  getSettings(): StoreSchema['settings'] {
    return this.store.get('settings')
  }

  updateSettings(updates: Partial<StoreSchema['settings']>): void {
    const current = this.getSettings()
    this.store.set('settings', { ...current, ...updates })
  }

  // AI prompt supplement helpers
  getAIPromptSupplement(): string {
    return this.getSettings().aiPromptSupplement
  }

  setAIPromptSupplement(supplement: string): void {
    this.updateSettings({ aiPromptSupplement: supplement })
  }

  // Auth helpers
  getAuth(): StoreSchema['auth'] {
    return this.store.get('auth')
  }

  getTokens(): OAuthTokens | null {
    return this.store.get('auth').tokens
  }

  setTokens(tokens: OAuthTokens | null): void {
    const auth = this.getAuth()
    this.store.set('auth', { ...auth, tokens })
  }

  getUser(): UserInfo | null {
    return this.store.get('auth').user
  }

  setUser(user: UserInfo | null): void {
    const auth = this.getAuth()
    this.store.set('auth', { ...auth, user })
  }

  clearAuth(): void {
    this.store.set('auth', { tokens: null, user: null })
  }

  isTokenExpired(): boolean {
    const tokens = this.getTokens()
    if (!tokens) return true
    // Consider expired if less than 5 minutes remaining
    return tokens.expiresAt < Date.now() + 5 * 60 * 1000
  }

  // LLM provider helpers
  getLLMProviders(): StoreSchema['llmProviders'] {
    return this.store.get('llmProviders')
  }

  setLLMApiKey(provider: 'openai' | 'anthropic' | 'google', apiKey: string | null): void {
    const providers = this.getLLMProviders()
    providers[provider].apiKey = apiKey

    // Auto-set as default if adding a key and no default is set
    if (apiKey && !providers.default) {
      providers.default = provider
    }

    // If removing the key of the default provider, clear the default
    if (!apiKey && providers.default === provider) {
      // Find another configured provider to be default
      const otherProviders: Array<'openai' | 'anthropic' | 'google'> = ['openai', 'anthropic', 'google']
      const newDefault = otherProviders.find(p => p !== provider && providers[p].apiKey)
      providers.default = newDefault ?? null
    }

    this.store.set('llmProviders', providers)
  }

  setDefaultLLMProvider(provider: 'openai' | 'anthropic' | 'google' | null): void {
    const providers = this.getLLMProviders()
    providers.default = provider
    this.store.set('llmProviders', providers)
  }

  setLLMModel(provider: 'openai' | 'anthropic' | 'google', model: string): void {
    const providers = this.getLLMProviders()
    providers[provider].model = model
    this.store.set('llmProviders', providers)
  }

  setLLMTemperature(temperature: number): void {
    const providers = this.getLLMProviders()
    providers.temperature = Math.max(0, Math.min(2, temperature))
    this.store.set('llmProviders', providers)
  }

  // Draft management
  saveDraft(draftId: string, classId: string, name: string, content: unknown): void {
    const drafts = this.store.get('drafts')
    drafts[draftId] = {
      id: draftId,
      classId,
      name,
      lastModified: new Date().toISOString(),
      content
    }
    this.store.set('drafts', drafts)
  }

  getDraft(draftId: string): StoreSchema['drafts'][string] | null {
    const drafts = this.store.get('drafts')
    return drafts[draftId] ?? null
  }

  listDrafts(): StoreSchema['drafts'][string][] {
    const drafts = this.store.get('drafts')
    return Object.values(drafts).sort(
      (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    )
  }

  deleteDraft(draftId: string): void {
    const drafts = this.store.get('drafts')
    delete drafts[draftId]
    this.store.set('drafts', drafts)
  }

  // Recent classes
  addRecentClass(classId: string): void {
    const recent = this.store.get('recentClasses')
    const filtered = recent.filter((id) => id !== classId)
    filtered.unshift(classId)
    this.store.set('recentClasses', filtered.slice(0, 5)) // Keep only 5 recent
  }

  getRecentClasses(): string[] {
    return this.store.get('recentClasses')
  }

  // Window state for persistence
  getWindowState(): StoreSchema['windowState'] {
    return this.store.get('windowState')
  }

  setWindowState(state: Partial<StoreSchema['windowState']>): void {
    const current = this.getWindowState()
    this.store.set('windowState', { ...current, ...state })
  }

  // Cache metadata for sync
  getCacheMetadata(key: string): StoreSchema['cacheMetadata'][string] | null {
    const metadata = this.store.get('cacheMetadata')
    return metadata[key] ?? null
  }

  setCacheMetadata(key: string, data: StoreSchema['cacheMetadata'][string]): void {
    const metadata = this.store.get('cacheMetadata')
    metadata[key] = data
    this.store.set('cacheMetadata', metadata)
  }

  // Last save directory for file dialogs
  getLastSaveDirectory(): string | null {
    return this.store.get('lastSaveDirectory')
  }

  setLastSaveDirectory(directory: string | null): void {
    this.store.set('lastSaveDirectory', directory)
  }

  // Clear all data (for logout/reset)
  clear(): void {
    this.store.clear()
    // Re-initialize with defaults
    Object.entries(defaults).forEach(([key, value]) => {
      this.store.set(key as keyof StoreSchema, value)
    })
  }
}

// Singleton instance
export const storageService = new StorageService()
