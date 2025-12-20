import { create } from 'zustand'
import type { Standards, StandardsSummary, CreateStandardsInput } from '../../../shared/types'
import type { ServiceResult } from '../../../shared/types/common.types'

interface StandardsState {
  // State
  standards: Standards | null
  summary: StandardsSummary | null
  currentCourseId: string | null
  loading: boolean
  error: string | null

  // Actions
  setCurrentCourseId: (courseId: string | null) => void
  fetchStandards: (courseId: string) => Promise<void>
  fetchSummary: (courseId: string) => Promise<void>
  saveStandards: (input: CreateStandardsInput) => Promise<Standards | null>
  deleteStandards: (courseId: string) => Promise<boolean>
  clearError: () => void
  clearStandards: () => void
}

export const useStandardsStore = create<StandardsState>((set) => ({
  // Initial state
  standards: null,
  summary: null,
  currentCourseId: null,
  loading: false,
  error: null,

  // Actions
  setCurrentCourseId: (courseId) => set({ currentCourseId: courseId }),

  clearError: () => set({ error: null }),

  clearStandards: () => set({ standards: null, summary: null, currentCourseId: null }),

  fetchStandards: async (courseId: string) => {
    set({ loading: true, error: null, currentCourseId: courseId })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Standards | null>>(
        'drive:getStandards',
        courseId
      )

      if (result.success) {
        set({ standards: result.data, loading: false })
      } else {
        set({ error: result.error, loading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch standards'
      set({ error: message, loading: false })
    }
  },

  fetchSummary: async (courseId: string) => {
    set({ loading: true, error: null, currentCourseId: courseId })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<StandardsSummary | null>>(
        'drive:getStandardsSummary',
        courseId
      )

      if (result.success) {
        set({ summary: result.data, loading: false })
      } else {
        set({ error: result.error, loading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch standards summary'
      set({ error: message, loading: false })
    }
  },

  saveStandards: async (input: CreateStandardsInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Standards>>(
        'drive:saveStandards',
        input
      )

      if (result.success) {
        set({ standards: result.data, loading: false })
        return result.data
      } else {
        set({ error: result.error, loading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save standards'
      set({ error: message, loading: false })
      return null
    }
  },

  deleteStandards: async (courseId: string) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<void>>(
        'drive:deleteStandards',
        courseId
      )

      if (result.success) {
        set({ standards: null, summary: null, loading: false })
        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete standards'
      set({ error: message, loading: false })
      return false
    }
  }
}))
