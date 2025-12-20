import { create } from 'zustand'
import type {
  Unit,
  UnitSummary,
  CreateUnitInput,
  UpdateUnitInput,
  ReorderUnitsInput
} from '../../../shared/types'
import type { ServiceResult } from '../../../shared/types/common.types'

interface UnitState {
  // State
  units: UnitSummary[]
  currentUnit: Unit | null
  currentCourseId: string | null
  loading: boolean
  error: string | null

  // Actions
  setCurrentCourseId: (courseId: string | null) => void
  fetchUnits: (courseId: string) => Promise<void>
  getUnit: (courseId: string, unitId: string) => Promise<Unit | null>
  createUnit: (input: CreateUnitInput) => Promise<Unit | null>
  updateUnit: (input: UpdateUnitInput) => Promise<Unit | null>
  deleteUnit: (courseId: string, unitId: string) => Promise<boolean>
  reorderUnits: (input: ReorderUnitsInput) => Promise<boolean>
  setCurrentUnit: (unit: Unit | null) => void
  clearError: () => void
  clearUnits: () => void
}

export const useUnitStore = create<UnitState>((set, get) => ({
  // Initial state
  units: [],
  currentUnit: null,
  currentCourseId: null,
  loading: false,
  error: null,

  // Actions
  setCurrentCourseId: (courseId) => set({ currentCourseId: courseId }),

  setCurrentUnit: (unit) => set({ currentUnit: unit }),

  clearError: () => set({ error: null }),

  clearUnits: () => set({ units: [], currentUnit: null, currentCourseId: null }),

  fetchUnits: async (courseId: string) => {
    set({ loading: true, error: null, currentCourseId: courseId })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<UnitSummary[]>>(
        'drive:listUnits',
        courseId
      )

      if (result.success) {
        set({ units: result.data, loading: false })
      } else {
        set({ error: result.error, loading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch units'
      set({ error: message, loading: false })
    }
  },

  getUnit: async (courseId: string, unitId: string) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Unit>>(
        'drive:getUnit',
        courseId,
        unitId
      )

      if (result.success) {
        set({ currentUnit: result.data, loading: false })
        return result.data
      } else {
        set({ error: result.error, loading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch unit'
      set({ error: message, loading: false })
      return null
    }
  },

  createUnit: async (input: CreateUnitInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Unit>>(
        'drive:createUnit',
        input
      )

      if (result.success) {
        // Refresh the unit list after creating
        const { currentCourseId } = get()
        if (currentCourseId) {
          const listResult = await window.electronAPI.invoke<ServiceResult<UnitSummary[]>>(
            'drive:listUnits',
            currentCourseId
          )

          if (listResult.success) {
            set({ units: listResult.data, loading: false })
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
      const message = error instanceof Error ? error.message : 'Failed to create unit'
      set({ error: message, loading: false })
      return null
    }
  },

  updateUnit: async (input: UpdateUnitInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Unit>>(
        'drive:updateUnit',
        input
      )

      if (result.success) {
        // Update the current unit if it matches
        const { currentUnit } = get()
        if (currentUnit && currentUnit.id === input.id) {
          set({ currentUnit: result.data })
        }

        // Refresh the unit list
        const { currentCourseId } = get()
        if (currentCourseId) {
          const listResult = await window.electronAPI.invoke<ServiceResult<UnitSummary[]>>(
            'drive:listUnits',
            currentCourseId
          )

          if (listResult.success) {
            set({ units: listResult.data, loading: false })
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
      const message = error instanceof Error ? error.message : 'Failed to update unit'
      set({ error: message, loading: false })
      return null
    }
  },

  deleteUnit: async (courseId: string, unitId: string) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<void>>(
        'drive:deleteUnit',
        courseId,
        unitId
      )

      if (result.success) {
        // Clear current unit if it was deleted
        const { currentUnit } = get()
        if (currentUnit && currentUnit.id === unitId) {
          set({ currentUnit: null })
        }

        // Refresh the unit list
        const listResult = await window.electronAPI.invoke<ServiceResult<UnitSummary[]>>(
          'drive:listUnits',
          courseId
        )

        if (listResult.success) {
          set({ units: listResult.data, loading: false })
        } else {
          set({ loading: false })
        }

        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete unit'
      set({ error: message, loading: false })
      return false
    }
  },

  reorderUnits: async (input: ReorderUnitsInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<void>>(
        'drive:reorderUnits',
        input
      )

      if (result.success) {
        // Refresh the unit list to get updated order
        const listResult = await window.electronAPI.invoke<ServiceResult<UnitSummary[]>>(
          'drive:listUnits',
          input.courseId
        )

        if (listResult.success) {
          set({ units: listResult.data, loading: false })
        } else {
          set({ loading: false })
        }

        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reorder units'
      set({ error: message, loading: false })
      return false
    }
  }
}))
