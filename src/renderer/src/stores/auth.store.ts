import { create } from 'zustand'

interface UserInfo {
  id: string
  email: string
  name: string
  picture?: string
}

interface AuthStatus {
  isAuthenticated: boolean
  isConfigured: boolean
  user: UserInfo | null
}

interface AuthResult {
  success: boolean
  user?: UserInfo
  error?: string
}

interface IPCResponse<T> {
  success: boolean
  data?: T
  error?: string
}

type AuthStateStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error' | 'not_configured'

interface AuthState {
  // State
  status: AuthStateStatus
  user: UserInfo | null
  error: string | null
  isConfigured: boolean

  // Actions
  setUser: (user: UserInfo | null) => void
  setStatus: (status: AuthStateStatus) => void
  setError: (error: string | null) => void
  login: () => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  // Initial state
  status: 'idle',
  user: null,
  error: null,
  isConfigured: false,

  // Actions
  setUser: (user) => set({ user, status: user ? 'authenticated' : 'unauthenticated' }),

  setStatus: (status) => set({ status }),

  setError: (error) => set({ error, status: error ? 'error' : 'idle' }),

  login: async () => {
    set({ status: 'loading', error: null })
    try {
      const result = await window.electronAPI.invoke<AuthResult>('auth:login')
      if (result.success && result.user) {
        set({ user: result.user, status: 'authenticated' })
      } else {
        set({ error: result.error ?? 'Login failed', status: 'error' })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      set({ error: message, status: 'error' })
    }
  },

  logout: async () => {
    set({ status: 'loading', error: null })
    try {
      const result = await window.electronAPI.invoke<{ success: boolean; error?: string }>('auth:logout')
      if (result.success) {
        set({ user: null, status: 'unauthenticated' })
      } else {
        set({ error: result.error ?? 'Logout failed', status: 'error' })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed'
      set({ error: message, status: 'error' })
    }
  },

  checkAuth: async () => {
    set({ status: 'loading', error: null })
    try {
      const result = await window.electronAPI.invoke<IPCResponse<AuthStatus>>('auth:getStatus')
      if (result.success && result.data) {
        const { isAuthenticated, isConfigured, user } = result.data
        set({
          isConfigured,
          user,
          status: !isConfigured
            ? 'not_configured'
            : isAuthenticated
              ? 'authenticated'
              : 'unauthenticated'
        })
      } else {
        set({ status: 'unauthenticated' })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Auth check failed'
      set({ error: message, status: 'error' })
    }
  }
}))

// Subscribe to auth status changes from main process
if (typeof window !== 'undefined' && window.electronAPI) {
  window.electronAPI.on('auth:statusChanged', (data) => {
    const authData = data as { isAuthenticated: boolean; user: UserInfo | null }
    const store = useAuthStore.getState()
    store.setUser(authData.user)
  })
}
