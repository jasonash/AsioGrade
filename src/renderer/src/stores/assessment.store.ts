import { create } from 'zustand'
import type {
  Assessment,
  AssessmentSummary,
  CreateAssessmentInput,
  UpdateAssessmentInput
} from '../../../shared/types'
import type { ServiceResult } from '../../../shared/types/common.types'

interface AssessmentState {
  // State
  assessments: AssessmentSummary[]
  currentAssessment: Assessment | null
  currentUnitId: string | null
  loading: boolean
  error: string | null

  // Actions
  setCurrentUnitId: (unitId: string | null) => void
  fetchAssessments: (unitId: string) => Promise<void>
  getAssessment: (assessmentId: string) => Promise<Assessment | null>
  createAssessment: (input: CreateAssessmentInput) => Promise<Assessment | null>
  updateAssessment: (input: UpdateAssessmentInput) => Promise<Assessment | null>
  deleteAssessment: (assessmentId: string, unitId: string) => Promise<boolean>
  setCurrentAssessment: (assessment: Assessment | null) => void
  clearError: () => void
  clearAssessments: () => void
}

export const useAssessmentStore = create<AssessmentState>((set, get) => ({
  // Initial state
  assessments: [],
  currentAssessment: null,
  currentUnitId: null,
  loading: false,
  error: null,

  // Actions
  setCurrentUnitId: (unitId) => set({ currentUnitId: unitId }),

  setCurrentAssessment: (assessment) => set({ currentAssessment: assessment }),

  clearError: () => set({ error: null }),

  clearAssessments: () =>
    set({ assessments: [], currentAssessment: null, currentUnitId: null }),

  fetchAssessments: async (unitId: string) => {
    set({ loading: true, error: null, currentUnitId: unitId })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<AssessmentSummary[]>>(
        'drive:listAssessments',
        unitId
      )

      if (result.success) {
        set({ assessments: result.data, loading: false })
      } else {
        set({ error: result.error, loading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch assessments'
      set({ error: message, loading: false })
    }
  },

  getAssessment: async (assessmentId: string) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Assessment>>(
        'drive:getAssessment',
        assessmentId
      )

      if (result.success) {
        set({ currentAssessment: result.data, loading: false })
        return result.data
      } else {
        set({ error: result.error, loading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch assessment'
      set({ error: message, loading: false })
      return null
    }
  },

  createAssessment: async (input: CreateAssessmentInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Assessment>>(
        'drive:createAssessment',
        input
      )

      if (result.success) {
        // Refresh the assessment list after creating
        const { currentUnitId } = get()
        if (currentUnitId) {
          const listResult = await window.electronAPI.invoke<ServiceResult<AssessmentSummary[]>>(
            'drive:listAssessments',
            currentUnitId
          )

          if (listResult.success) {
            set({ assessments: listResult.data, loading: false })
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
      const message = error instanceof Error ? error.message : 'Failed to create assessment'
      set({ error: message, loading: false })
      return null
    }
  },

  updateAssessment: async (input: UpdateAssessmentInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Assessment>>(
        'drive:updateAssessment',
        input
      )

      if (result.success) {
        // Update the current assessment if it matches
        const { currentAssessment } = get()
        if (currentAssessment && currentAssessment.id === input.id) {
          set({ currentAssessment: result.data })
        }

        // Refresh the assessment list
        const { currentUnitId } = get()
        if (currentUnitId) {
          const listResult = await window.electronAPI.invoke<ServiceResult<AssessmentSummary[]>>(
            'drive:listAssessments',
            currentUnitId
          )

          if (listResult.success) {
            set({ assessments: listResult.data, loading: false })
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
      const message = error instanceof Error ? error.message : 'Failed to update assessment'
      set({ error: message, loading: false })
      return null
    }
  },

  deleteAssessment: async (assessmentId: string, unitId: string) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<void>>(
        'drive:deleteAssessment',
        assessmentId,
        unitId
      )

      if (result.success) {
        // Clear current assessment if it was deleted
        const { currentAssessment } = get()
        if (currentAssessment && currentAssessment.id === assessmentId) {
          set({ currentAssessment: null })
        }

        // Refresh the assessment list
        const listResult = await window.electronAPI.invoke<ServiceResult<AssessmentSummary[]>>(
          'drive:listAssessments',
          unitId
        )

        if (listResult.success) {
          set({ assessments: listResult.data, loading: false })
        } else {
          set({ loading: false })
        }

        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete assessment'
      set({ error: message, loading: false })
      return false
    }
  }
}))
