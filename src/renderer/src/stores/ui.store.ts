import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { NavItem } from '../components/layout'

type Theme = 'dark' | 'light' | 'system'

interface UIState {
  // Sidebar
  sidebarExpanded: boolean
  activeNav: NavItem

  // Theme
  theme: Theme
  resolvedTheme: 'dark' | 'light' // Actual theme after resolving 'system'

  // Actions
  toggleSidebar: () => void
  setSidebarExpanded: (expanded: boolean) => void
  setActiveNav: (nav: NavItem) => void
  setTheme: (theme: Theme) => void
}

// Get system preference
function getSystemTheme(): 'dark' | 'light' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'dark'
}

// Resolve theme setting to actual theme
function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return getSystemTheme()
  }
  return theme
}

// Apply theme to document
function applyTheme(resolvedTheme: 'dark' | 'light'): void {
  if (typeof document !== 'undefined') {
    if (resolvedTheme === 'light') {
      document.documentElement.classList.add('light')
    } else {
      document.documentElement.classList.remove('light')
    }
  }
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Initial state
      sidebarExpanded: true,
      activeNav: 'dashboard',
      theme: 'dark',
      resolvedTheme: 'dark',

      // Actions
      toggleSidebar: () => set((state) => ({ sidebarExpanded: !state.sidebarExpanded })),

      setSidebarExpanded: (expanded) => set({ sidebarExpanded: expanded }),

      setActiveNav: (nav) => set({ activeNav: nav }),

      setTheme: (theme) => {
        const resolvedTheme = resolveTheme(theme)
        applyTheme(resolvedTheme)
        set({ theme, resolvedTheme })
      }
    }),
    {
      name: 'teachinghelp-ui',
      partialize: (state) => ({
        sidebarExpanded: state.sidebarExpanded,
        theme: state.theme
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Apply theme on rehydration
          const resolvedTheme = resolveTheme(state.theme)
          applyTheme(resolvedTheme)
          state.resolvedTheme = resolvedTheme
        }
      }
    }
  )
)

// Listen for system theme changes
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const state = useUIStore.getState()
    if (state.theme === 'system') {
      const resolvedTheme = getSystemTheme()
      applyTheme(resolvedTheme)
      useUIStore.setState({ resolvedTheme })
    }
  })
}
