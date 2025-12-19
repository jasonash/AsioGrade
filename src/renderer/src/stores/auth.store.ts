import { create } from 'zustand'

interface UserInfo {
  id: string
  email: string
  name: string
  picture?: string
}

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error'

interface AuthState {
  // State
  status: AuthStatus
  user: UserInfo | null
  error: string | null

  // Actions
  setUser: (user: UserInfo | null) => void
  setStatus: (status: AuthStatus) => void
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

  // Actions
  setUser: (user) => set({ user, status: user ? 'authenticated' : 'unauthenticated' }),

  setStatus: (status) => set({ status }),

  setError: (error) => set({ error, status: error ? 'error' : 'idle' }),

  login: async () => {
    set({ status: 'loading', error: null })
    try {
      // This will be implemented when we add Google OAuth
      // const result = await window.electronAPI.auth.login()
      // if (result.success && result.user) {
      //   set({ user: result.user, status: 'authenticated' })
      // } else {
      //   set({ error: result.error ?? 'Login failed', status: 'error' })
      // }

      // For now, simulate unauthenticated state
      set({ status: 'unauthenticated' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      set({ error: message, status: 'error' })
    }
  },

  logout: async () => {
    set({ status: 'loading', error: null })
    try {
      // This will be implemented when we add Google OAuth
      // await window.electronAPI.auth.logout()
      set({ user: null, status: 'unauthenticated' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed'
      set({ error: message, status: 'error' })
    }
  },

  checkAuth: async () => {
    set({ status: 'loading', error: null })
    try {
      // This will be implemented when we add Google OAuth
      // const isAuthenticated = await window.electronAPI.auth.isAuthenticated()
      // if (isAuthenticated) {
      //   const user = await window.electronAPI.auth.getCurrentUser()
      //   set({ user, status: 'authenticated' })
      // } else {
      //   set({ status: 'unauthenticated' })
      // }

      // For now, simulate unauthenticated state
      set({ status: 'unauthenticated' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Auth check failed'
      set({ error: message, status: 'error' })
    }
  }
}))
