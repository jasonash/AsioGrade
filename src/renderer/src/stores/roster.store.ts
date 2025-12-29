import { create } from 'zustand'
import type {
  Roster,
  Student,
  CreateStudentInput,
  UpdateStudentInput,
  DOKLevel
} from '../../../shared/types'
import type { ServiceResult } from '../../../shared/types/common.types'

interface RosterState {
  // State
  roster: Roster | null
  currentSectionId: string | null
  loading: boolean
  error: string | null

  // Actions
  fetchRoster: (sectionId: string) => Promise<void>
  addStudent: (sectionId: string, input: CreateStudentInput) => Promise<Student | null>
  updateStudent: (sectionId: string, input: UpdateStudentInput) => Promise<Student | null>
  updateStudentDOK: (sectionId: string, studentId: string, dokLevel: DOKLevel) => Promise<boolean>
  deleteStudent: (sectionId: string, studentId: string) => Promise<boolean>
  importStudents: (sectionId: string, students: CreateStudentInput[]) => Promise<number>
  clearRoster: () => void
  clearError: () => void
}

export const useRosterStore = create<RosterState>((set, get) => ({
  // Initial state
  roster: null,
  currentSectionId: null,
  loading: false,
  error: null,

  // Actions
  clearError: () => set({ error: null }),

  clearRoster: () => set({ roster: null, currentSectionId: null }),

  fetchRoster: async (sectionId: string) => {
    set({ loading: true, error: null, currentSectionId: sectionId })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Roster>>(
        'drive:getRoster',
        sectionId
      )

      if (result.success) {
        set({ roster: result.data, loading: false })
      } else {
        set({ error: result.error, loading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch roster'
      set({ error: message, loading: false })
    }
  },

  addStudent: async (sectionId: string, input: CreateStudentInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Student>>(
        'drive:addStudent',
        sectionId,
        input
      )

      if (result.success) {
        // Refresh roster to get updated list
        await get().fetchRoster(sectionId)
        return result.data
      } else {
        set({ error: result.error, loading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add student'
      set({ error: message, loading: false })
      return null
    }
  },

  updateStudent: async (sectionId: string, input: UpdateStudentInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Student>>(
        'drive:updateStudent',
        sectionId,
        input
      )

      if (result.success) {
        // Refresh roster to get updated list
        await get().fetchRoster(sectionId)
        return result.data
      } else {
        set({ error: result.error, loading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update student'
      set({ error: message, loading: false })
      return null
    }
  },

  updateStudentDOK: async (sectionId: string, studentId: string, dokLevel: DOKLevel) => {
    // Don't set loading to true for inline DOK updates to avoid UI flicker
    set({ error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Student>>(
        'drive:updateStudent',
        sectionId,
        { id: studentId, dokLevel }
      )

      if (result.success) {
        // Update the roster in place without full refresh for better UX
        const roster = get().roster
        if (roster) {
          const updatedStudents = roster.students.map((s) =>
            s.id === studentId ? { ...s, dokLevel } : s
          )
          set({ roster: { ...roster, students: updatedStudents } })
        }
        return true
      } else {
        set({ error: result.error })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update DOK level'
      set({ error: message })
      return false
    }
  },

  deleteStudent: async (sectionId: string, studentId: string) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<void>>(
        'drive:deleteStudent',
        sectionId,
        studentId
      )

      if (result.success) {
        // Refresh roster to get updated list
        await get().fetchRoster(sectionId)
        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete student'
      set({ error: message, loading: false })
      return false
    }
  },

  importStudents: async (sectionId: string, students: CreateStudentInput[]) => {
    set({ loading: true, error: null })

    let successCount = 0
    const errors: string[] = []

    for (const student of students) {
      try {
        const result = await window.electronAPI.invoke<ServiceResult<Student>>(
          'drive:addStudent',
          sectionId,
          student
        )
        if (result.success) {
          successCount++
        } else {
          errors.push(`${student.firstName} ${student.lastName}: ${result.error}`)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`${student.firstName} ${student.lastName}: ${message}`)
      }
    }

    // Refresh roster after import
    await get().fetchRoster(sectionId)

    if (errors.length > 0) {
      set({
        error: `Imported ${successCount} of ${students.length} students. Errors: ${errors.join('; ')}`,
        loading: false
      })
    } else {
      set({ loading: false })
    }

    return successCount
  }
}))
