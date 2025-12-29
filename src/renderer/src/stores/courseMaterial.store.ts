import { create } from 'zustand'
import type {
  CourseMaterial,
  CourseMaterialSummary,
  UpdateMaterialInput,
  ServiceResult
} from '../../../shared/types'

interface CourseMaterialState {
  // State
  materials: CourseMaterialSummary[]
  currentMaterial: CourseMaterial | null
  isLoading: boolean
  isUploading: boolean
  error: string | null

  // Actions
  fetchMaterials: (courseId: string) => Promise<void>
  uploadMaterial: (courseId: string, filePath: string, name: string) => Promise<CourseMaterial | null>
  getMaterial: (materialId: string) => Promise<CourseMaterial | null>
  updateMaterial: (input: UpdateMaterialInput) => Promise<CourseMaterial | null>
  deleteMaterial: (materialId: string, courseId: string) => Promise<boolean>
  setCurrentMaterial: (material: CourseMaterial | null) => void
  clearError: () => void
}

export const useCourseMaterialStore = create<CourseMaterialState>((set, get) => ({
  // Initial state
  materials: [],
  currentMaterial: null,
  isLoading: false,
  isUploading: false,
  error: null,

  // Actions
  clearError: () => set({ error: null }),

  setCurrentMaterial: (material) => set({ currentMaterial: material }),

  fetchMaterials: async (courseId: string) => {
    set({ isLoading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<CourseMaterialSummary[]>>(
        'material:list',
        courseId
      )

      if (result.success) {
        set({ materials: result.data, isLoading: false })
      } else {
        set({ error: result.error, isLoading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch materials'
      set({ error: message, isLoading: false })
    }
  },

  uploadMaterial: async (courseId: string, filePath: string, name: string) => {
    set({ isUploading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<CourseMaterial>>(
        'material:upload',
        courseId,
        filePath,
        name
      )

      if (result.success) {
        // Refresh the materials list
        await get().fetchMaterials(courseId)
        set({ isUploading: false })
        return result.data
      } else {
        set({ error: result.error, isUploading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload material'
      set({ error: message, isUploading: false })
      return null
    }
  },

  getMaterial: async (materialId: string) => {
    set({ isLoading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<CourseMaterial>>(
        'material:get',
        materialId
      )

      if (result.success) {
        set({ currentMaterial: result.data, isLoading: false })
        return result.data
      } else {
        set({ error: result.error, isLoading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get material'
      set({ error: message, isLoading: false })
      return null
    }
  },

  updateMaterial: async (input: UpdateMaterialInput) => {
    set({ isLoading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<CourseMaterial>>(
        'material:update',
        input
      )

      if (result.success) {
        // Refresh the materials list
        await get().fetchMaterials(input.courseId)
        set({ currentMaterial: result.data, isLoading: false })
        return result.data
      } else {
        set({ error: result.error, isLoading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update material'
      set({ error: message, isLoading: false })
      return null
    }
  },

  deleteMaterial: async (materialId: string, courseId: string) => {
    set({ isLoading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<void>>(
        'material:delete',
        materialId,
        courseId
      )

      if (result.success) {
        // Refresh the materials list
        await get().fetchMaterials(courseId)
        // Clear current material if it was deleted
        const { currentMaterial } = get()
        if (currentMaterial?.id === materialId) {
          set({ currentMaterial: null })
        }
        set({ isLoading: false })
        return true
      } else {
        set({ error: result.error, isLoading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete material'
      set({ error: message, isLoading: false })
      return false
    }
  }
}))
