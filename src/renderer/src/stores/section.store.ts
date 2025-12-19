import { create } from 'zustand'
import type { Section, SectionSummary, CreateSectionInput } from '../../../shared/types'
import type { ServiceResult } from '../../../shared/types/common.types'

interface SectionState {
  // State
  sections: SectionSummary[]
  currentCourseId: string | null
  loading: boolean
  error: string | null

  // Actions
  setCurrentCourseId: (courseId: string | null) => void
  fetchSections: (courseId: string) => Promise<void>
  createSection: (input: CreateSectionInput) => Promise<Section | null>
  clearError: () => void
  clearSections: () => void
}

export const useSectionStore = create<SectionState>((set, get) => ({
  // Initial state
  sections: [],
  currentCourseId: null,
  loading: false,
  error: null,

  // Actions
  setCurrentCourseId: (courseId) => set({ currentCourseId: courseId }),

  clearError: () => set({ error: null }),

  clearSections: () => set({ sections: [], currentCourseId: null }),

  fetchSections: async (courseId: string) => {
    set({ loading: true, error: null, currentCourseId: courseId })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<SectionSummary[]>>(
        'drive:listSections',
        courseId
      )

      if (result.success) {
        set({ sections: result.data, loading: false })
      } else {
        set({ error: result.error, loading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch sections'
      set({ error: message, loading: false })
    }
  },

  createSection: async (input: CreateSectionInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Section>>(
        'drive:createSection',
        input
      )

      if (result.success) {
        // Refresh the section list after creating
        const { currentCourseId } = get()
        if (currentCourseId) {
          const listResult = await window.electronAPI.invoke<ServiceResult<SectionSummary[]>>(
            'drive:listSections',
            currentCourseId
          )

          if (listResult.success) {
            set({ sections: listResult.data, loading: false })
          } else {
            set({ loading: false })
          }
        } else {
          set({ loading: false })
        }

        return result.data
      } else {
        set({ error: result.error, loading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create section'
      set({ error: message, loading: false })
      return null
    }
  }
}))
