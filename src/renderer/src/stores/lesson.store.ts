import { create } from 'zustand'
import type {
  Lesson,
  LessonSummary,
  CreateLessonInput,
  UpdateLessonInput,
  ReorderLessonsInput,
  UnitMaterialSummary,
  UnitMaterial,
  UploadUnitMaterialInput
} from '../../../shared/types'
import type { ServiceResult } from '../../../shared/types/common.types'

interface LessonState {
  // State
  lessons: LessonSummary[]
  currentLesson: Lesson | null
  currentUnitId: string | null
  loading: boolean
  error: string | null

  // Unit Materials State
  materials: UnitMaterialSummary[]
  materialsLoading: boolean
  materialsError: string | null

  // Actions
  setCurrentUnitId: (unitId: string | null) => void
  fetchLessons: (unitId: string) => Promise<void>
  getLesson: (lessonId: string) => Promise<Lesson | null>
  createLesson: (input: CreateLessonInput) => Promise<Lesson | null>
  updateLesson: (input: UpdateLessonInput) => Promise<Lesson | null>
  deleteLesson: (lessonId: string, unitId: string) => Promise<boolean>
  reorderLessons: (input: ReorderLessonsInput) => Promise<boolean>
  setCurrentLesson: (lesson: Lesson | null) => void
  clearError: () => void
  clearLessons: () => void

  // Unit Materials Actions
  fetchMaterials: (unitId: string) => Promise<void>
  uploadMaterial: (input: UploadUnitMaterialInput) => Promise<UnitMaterial | null>
  deleteMaterial: (materialId: string, unitId: string) => Promise<boolean>
  getMaterialsContext: (unitId: string) => Promise<string>
  clearMaterialsError: () => void
}

export const useLessonStore = create<LessonState>((set, get) => ({
  // Initial state
  lessons: [],
  currentLesson: null,
  currentUnitId: null,
  loading: false,
  error: null,

  // Unit Materials Initial State
  materials: [],
  materialsLoading: false,
  materialsError: null,

  // Actions
  setCurrentUnitId: (unitId) => set({ currentUnitId: unitId }),

  setCurrentLesson: (lesson) => set({ currentLesson: lesson }),

  clearError: () => set({ error: null }),

  clearLessons: () =>
    set({ lessons: [], currentLesson: null, currentUnitId: null }),

  clearMaterialsError: () => set({ materialsError: null }),

  fetchLessons: async (unitId: string) => {
    set({ loading: true, error: null, currentUnitId: unitId })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<LessonSummary[]>>(
        'drive:listLessons',
        unitId
      )

      if (result.success) {
        set({ lessons: result.data, loading: false })
      } else {
        set({ error: result.error, loading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch lessons'
      set({ error: message, loading: false })
    }
  },

  getLesson: async (lessonId: string) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Lesson>>(
        'drive:getLesson',
        lessonId
      )

      if (result.success) {
        set({ currentLesson: result.data, loading: false })
        return result.data
      } else {
        set({ error: result.error, loading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch lesson'
      set({ error: message, loading: false })
      return null
    }
  },

  createLesson: async (input: CreateLessonInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Lesson>>(
        'drive:createLesson',
        input
      )

      if (result.success) {
        // Refresh the lesson list after creating
        const { currentUnitId } = get()
        if (currentUnitId) {
          const listResult = await window.electronAPI.invoke<ServiceResult<LessonSummary[]>>(
            'drive:listLessons',
            currentUnitId
          )

          if (listResult.success) {
            set({ lessons: listResult.data, loading: false })
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
      const message = error instanceof Error ? error.message : 'Failed to create lesson'
      set({ error: message, loading: false })
      return null
    }
  },

  updateLesson: async (input: UpdateLessonInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Lesson>>(
        'drive:updateLesson',
        input
      )

      if (result.success) {
        // Update the current lesson if it matches
        const { currentLesson } = get()
        if (currentLesson && currentLesson.id === input.id) {
          set({ currentLesson: result.data })
        }

        // Refresh the lesson list
        const { currentUnitId } = get()
        if (currentUnitId) {
          const listResult = await window.electronAPI.invoke<ServiceResult<LessonSummary[]>>(
            'drive:listLessons',
            currentUnitId
          )

          if (listResult.success) {
            set({ lessons: listResult.data, loading: false })
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
      const message = error instanceof Error ? error.message : 'Failed to update lesson'
      set({ error: message, loading: false })
      return null
    }
  },

  deleteLesson: async (lessonId: string, unitId: string) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<void>>(
        'drive:deleteLesson',
        lessonId,
        unitId
      )

      if (result.success) {
        // Clear current lesson if it was deleted
        const { currentLesson } = get()
        if (currentLesson && currentLesson.id === lessonId) {
          set({ currentLesson: null })
        }

        // Refresh the lesson list
        const listResult = await window.electronAPI.invoke<ServiceResult<LessonSummary[]>>(
          'drive:listLessons',
          unitId
        )

        if (listResult.success) {
          set({ lessons: listResult.data, loading: false })
        } else {
          set({ loading: false })
        }

        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete lesson'
      set({ error: message, loading: false })
      return false
    }
  },

  reorderLessons: async (input: ReorderLessonsInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<void>>(
        'drive:reorderLessons',
        input
      )

      if (result.success) {
        // Refresh the lesson list
        const listResult = await window.electronAPI.invoke<ServiceResult<LessonSummary[]>>(
          'drive:listLessons',
          input.unitId
        )

        if (listResult.success) {
          set({ lessons: listResult.data, loading: false })
        } else {
          set({ loading: false })
        }

        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reorder lessons'
      set({ error: message, loading: false })
      return false
    }
  },

  // ============================================================
  // Unit Materials Actions
  // ============================================================

  fetchMaterials: async (unitId: string) => {
    set({ materialsLoading: true, materialsError: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<UnitMaterialSummary[]>>(
        'drive:listUnitMaterials',
        unitId
      )

      if (result.success) {
        set({ materials: result.data, materialsLoading: false })
      } else {
        set({ materialsError: result.error, materialsLoading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch materials'
      set({ materialsError: message, materialsLoading: false })
    }
  },

  uploadMaterial: async (input: UploadUnitMaterialInput) => {
    set({ materialsLoading: true, materialsError: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<UnitMaterial>>(
        'drive:uploadUnitMaterial',
        input
      )

      if (result.success) {
        // Refresh the materials list
        const listResult = await window.electronAPI.invoke<ServiceResult<UnitMaterialSummary[]>>(
          'drive:listUnitMaterials',
          input.unitId
        )

        if (listResult.success) {
          set({ materials: listResult.data, materialsLoading: false })
        } else {
          set({ materialsLoading: false })
        }

        return result.data
      } else {
        set({ materialsError: result.error, materialsLoading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload material'
      set({ materialsError: message, materialsLoading: false })
      return null
    }
  },

  deleteMaterial: async (materialId: string, unitId: string) => {
    set({ materialsLoading: true, materialsError: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<void>>(
        'drive:deleteUnitMaterial',
        materialId
      )

      if (result.success) {
        // Refresh the materials list
        const listResult = await window.electronAPI.invoke<ServiceResult<UnitMaterialSummary[]>>(
          'drive:listUnitMaterials',
          unitId
        )

        if (listResult.success) {
          set({ materials: listResult.data, materialsLoading: false })
        } else {
          set({ materialsLoading: false })
        }

        return true
      } else {
        set({ materialsError: result.error, materialsLoading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete material'
      set({ materialsError: message, materialsLoading: false })
      return false
    }
  },

  getMaterialsContext: async (unitId: string) => {
    try {
      const result = await window.electronAPI.invoke<ServiceResult<string>>(
        'drive:getUnitMaterialsContext',
        unitId
      )

      if (result.success) {
        return result.data
      } else {
        return ''
      }
    } catch {
      return ''
    }
  }
}))
