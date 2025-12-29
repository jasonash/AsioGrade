import { create } from 'zustand'
import type {
  Assessment,
  AssessmentSummary,
  CreateAssessmentInput,
  UpdateAssessmentInput,
  AssessmentVariant,
  VariantStrategy,
  AssessmentVersion
} from '../../../shared/types'
import type { ServiceResult } from '../../../shared/types/common.types'
import type { DOKLevel } from '../../../shared/types/roster.types'
import type { DOKVariantGenerationResult } from '../../../shared/types/ai.types'

interface AssessmentState {
  // State
  assessments: AssessmentSummary[]
  currentAssessment: Assessment | null
  currentCourseId: string | null
  loading: boolean
  generatingVariant: boolean
  generatingVersions: boolean
  error: string | null

  // Actions
  setCurrentCourseId: (courseId: string | null) => void
  fetchAssessments: (courseId: string) => Promise<void>
  getAssessment: (assessmentId: string) => Promise<Assessment | null>
  createAssessment: (input: CreateAssessmentInput) => Promise<Assessment | null>
  updateAssessment: (input: UpdateAssessmentInput) => Promise<Assessment | null>
  deleteAssessment: (assessmentId: string, courseId: string) => Promise<boolean>
  generateDOKVariant: (
    assessmentId: string,
    courseId: string,
    targetDOK: DOKLevel,
    strategy: VariantStrategy,
    standardRefs: string[],
    gradeLevel: string,
    subject: string
  ) => Promise<AssessmentVariant | null>
  deleteVariant: (variantId: string) => Promise<boolean>
  generateVersions: (assessmentId: string, courseId: string) => Promise<AssessmentVersion[] | null>
  clearVersions: (assessmentId: string, courseId: string) => Promise<boolean>
  setCurrentAssessment: (assessment: Assessment | null) => void
  clearError: () => void
  clearAssessments: () => void
}

export const useAssessmentStore = create<AssessmentState>((set, get) => ({
  // Initial state
  assessments: [],
  currentAssessment: null,
  currentCourseId: null,
  loading: false,
  generatingVariant: false,
  generatingVersions: false,
  error: null,

  // Actions
  setCurrentCourseId: (courseId) => set({ currentCourseId: courseId }),

  setCurrentAssessment: (assessment) => set({ currentAssessment: assessment }),

  clearError: () => set({ error: null }),

  clearAssessments: () =>
    set({ assessments: [], currentAssessment: null, currentCourseId: null }),

  fetchAssessments: async (courseId: string) => {
    set({ loading: true, error: null, currentCourseId: courseId })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<AssessmentSummary[]>>(
        'drive:listAssessments',
        courseId
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
        const { currentCourseId } = get()
        if (currentCourseId) {
          const listResult = await window.electronAPI.invoke<ServiceResult<AssessmentSummary[]>>(
            'drive:listAssessments',
            currentCourseId
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
        const { currentCourseId } = get()
        if (currentCourseId) {
          const listResult = await window.electronAPI.invoke<ServiceResult<AssessmentSummary[]>>(
            'drive:listAssessments',
            currentCourseId
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

  deleteAssessment: async (assessmentId: string, courseId: string) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<void>>(
        'drive:deleteAssessment',
        assessmentId,
        courseId
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
          courseId
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
  },

  generateDOKVariant: async (
    assessmentId: string,
    courseId: string,
    targetDOK: DOKLevel,
    strategy: VariantStrategy,
    standardRefs: string[],
    gradeLevel: string,
    subject: string
  ) => {
    set({ generatingVariant: true, error: null })

    try {
      // Generate the variant via AI
      const result = await window.electronAPI.invoke<ServiceResult<DOKVariantGenerationResult>>(
        'ai:generateDOKVariant',
        {
          assessmentId,
          courseId,
          targetDOK,
          strategy,
          standardRefs,
          gradeLevel,
          subject
        }
      )

      if (!result.success) {
        set({ error: result.error, generatingVariant: false })
        return null
      }

      const variant = result.data.variant

      // Get current assessment to update with new variant
      const { currentAssessment } = get()
      if (!currentAssessment || currentAssessment.id !== assessmentId) {
        set({ error: 'Assessment not loaded', generatingVariant: false })
        return null
      }

      // Add variant to assessment's variants array
      const existingVariants = currentAssessment.variants ?? []
      const updatedVariants = [...existingVariants, variant]

      // Save the updated assessment
      const updateResult = await window.electronAPI.invoke<ServiceResult<Assessment>>(
        'drive:updateAssessment',
        {
          id: assessmentId,
          courseId,
          variants: updatedVariants
        }
      )

      if (updateResult.success) {
        set({ currentAssessment: updateResult.data, generatingVariant: false })
        return variant
      } else {
        set({ error: updateResult.error, generatingVariant: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate DOK variant'
      set({ error: message, generatingVariant: false })
      return null
    }
  },

  deleteVariant: async (variantId: string) => {
    const { currentAssessment, currentCourseId } = get()

    if (!currentAssessment || !currentCourseId) {
      set({ error: 'No assessment loaded' })
      return false
    }

    set({ loading: true, error: null })

    try {
      // Remove variant from variants array
      const updatedVariants = (currentAssessment.variants ?? []).filter((v) => v.id !== variantId)

      // Save the updated assessment
      const result = await window.electronAPI.invoke<ServiceResult<Assessment>>(
        'drive:updateAssessment',
        {
          id: currentAssessment.id,
          courseId: currentCourseId,
          variants: updatedVariants
        }
      )

      if (result.success) {
        set({ currentAssessment: result.data, loading: false })
        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete variant'
      set({ error: message, loading: false })
      return false
    }
  },

  generateVersions: async (assessmentId: string, courseId: string) => {
    set({ generatingVersions: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Assessment>>(
        'assessment:generateVersions',
        assessmentId,
        courseId
      )

      if (result.success) {
        set({ currentAssessment: result.data, generatingVersions: false })
        return result.data.versions ?? null
      } else {
        set({ error: result.error, generatingVersions: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate versions'
      set({ error: message, generatingVersions: false })
      return null
    }
  },

  clearVersions: async (assessmentId: string, courseId: string) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Assessment>>(
        'assessment:clearVersions',
        assessmentId,
        courseId
      )

      if (result.success) {
        set({ currentAssessment: result.data, loading: false })
        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clear versions'
      set({ error: message, loading: false })
      return false
    }
  }
}))
