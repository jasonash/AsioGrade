import { create } from 'zustand'
import type {
  Assignment,
  AssignmentSummary,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  ScantronGenerationRequest
} from '../../../shared/types'
import type { ServiceResult } from '../../../shared/types/common.types'

interface ScantronResult {
  pdfBase64: string
  studentCount: number
  pageCount: number
  generatedAt: string
}

interface AssignmentState {
  // State
  assignments: AssignmentSummary[]
  currentAssignment: Assignment | null
  currentSectionId: string | null
  loading: boolean
  error: string | null
  generatingScantron: boolean

  // Actions
  setCurrentSectionId: (sectionId: string | null) => void
  fetchAssignments: (sectionId: string) => Promise<void>
  getAssignment: (assignmentId: string) => Promise<Assignment | null>
  createAssignment: (input: CreateAssignmentInput) => Promise<Assignment | null>
  updateAssignment: (input: UpdateAssignmentInput) => Promise<Assignment | null>
  deleteAssignment: (assignmentId: string, sectionId: string) => Promise<boolean>
  generateScantron: (request: ScantronGenerationRequest) => Promise<ScantronResult | null>
  setCurrentAssignment: (assignment: Assignment | null) => void
  clearError: () => void
  clearAssignments: () => void
}

export const useAssignmentStore = create<AssignmentState>((set, get) => ({
  // Initial state
  assignments: [],
  currentAssignment: null,
  currentSectionId: null,
  loading: false,
  error: null,
  generatingScantron: false,

  // Actions
  setCurrentSectionId: (sectionId) => set({ currentSectionId: sectionId }),

  setCurrentAssignment: (assignment) => set({ currentAssignment: assignment }),

  clearError: () => set({ error: null }),

  clearAssignments: () =>
    set({ assignments: [], currentAssignment: null, currentSectionId: null }),

  fetchAssignments: async (sectionId: string) => {
    set({ loading: true, error: null, currentSectionId: sectionId })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<AssignmentSummary[]>>(
        'drive:listAssignments',
        sectionId
      )

      if (result.success) {
        set({ assignments: result.data, loading: false })
      } else {
        set({ error: result.error, loading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch assignments'
      set({ error: message, loading: false })
    }
  },

  getAssignment: async (assignmentId: string) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Assignment>>(
        'drive:getAssignment',
        assignmentId
      )

      if (result.success) {
        set({ currentAssignment: result.data, loading: false })
        return result.data
      } else {
        set({ error: result.error, loading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch assignment'
      set({ error: message, loading: false })
      return null
    }
  },

  createAssignment: async (input: CreateAssignmentInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Assignment>>(
        'drive:createAssignment',
        input
      )

      if (result.success) {
        // Refresh the assignment list after creating
        const { currentSectionId } = get()
        if (currentSectionId) {
          const listResult = await window.electronAPI.invoke<ServiceResult<AssignmentSummary[]>>(
            'drive:listAssignments',
            currentSectionId
          )

          if (listResult.success) {
            set({ assignments: listResult.data, loading: false })
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
      const message = error instanceof Error ? error.message : 'Failed to create assignment'
      set({ error: message, loading: false })
      return null
    }
  },

  updateAssignment: async (input: UpdateAssignmentInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Assignment>>(
        'drive:updateAssignment',
        input
      )

      if (result.success) {
        // Update the current assignment if it matches
        const { currentAssignment } = get()
        if (currentAssignment && currentAssignment.id === input.id) {
          set({ currentAssignment: result.data })
        }

        // Refresh the assignment list
        const { currentSectionId } = get()
        if (currentSectionId) {
          const listResult = await window.electronAPI.invoke<ServiceResult<AssignmentSummary[]>>(
            'drive:listAssignments',
            currentSectionId
          )

          if (listResult.success) {
            set({ assignments: listResult.data, loading: false })
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
      const message = error instanceof Error ? error.message : 'Failed to update assignment'
      set({ error: message, loading: false })
      return null
    }
  },

  deleteAssignment: async (assignmentId: string, sectionId: string) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<void>>(
        'drive:deleteAssignment',
        assignmentId,
        sectionId
      )

      if (result.success) {
        // Clear current assignment if it was deleted
        const { currentAssignment } = get()
        if (currentAssignment && currentAssignment.id === assignmentId) {
          set({ currentAssignment: null })
        }

        // Refresh the assignment list
        const listResult = await window.electronAPI.invoke<ServiceResult<AssignmentSummary[]>>(
          'drive:listAssignments',
          sectionId
        )

        if (listResult.success) {
          set({ assignments: listResult.data, loading: false })
        } else {
          set({ loading: false })
        }

        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete assignment'
      set({ error: message, loading: false })
      return false
    }
  },

  generateScantron: async (request: ScantronGenerationRequest) => {
    set({ generatingScantron: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<ScantronResult>>(
        'pdf:generateScantron',
        request
      )

      if (result.success) {
        set({ generatingScantron: false })
        return result.data
      } else {
        set({ error: result.error, generatingScantron: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate scantron'
      set({ error: message, generatingScantron: false })
      return null
    }
  }
}))
