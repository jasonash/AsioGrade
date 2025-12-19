import { create } from 'zustand'
import type { Course, CourseSummary, CreateCourseInput } from '../../../shared/types'
import type { ServiceResult } from '../../../shared/types/common.types'

/**
 * Calculate the current academic year based on the date.
 * Academic year runs July-June, so:
 * - July 2024 - June 2025 = "2024-2025"
 */
function getCurrentAcademicYear(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed, so July = 6

  // If we're in July or later, we're in the year-nextYear academic year
  // If we're before July, we're in the previousYear-year academic year
  if (month >= 6) {
    return `${year}-${year + 1}`
  } else {
    return `${year - 1}-${year}`
  }
}

interface CourseState {
  // State
  courses: CourseSummary[]
  currentCourse: CourseSummary | null
  loading: boolean
  error: string | null
  academicYear: string

  // Actions
  setAcademicYear: (year: string) => void
  setCurrentCourse: (course: CourseSummary | null) => void
  fetchCourses: (year?: string) => Promise<void>
  createCourse: (input: CreateCourseInput) => Promise<Course | null>
  clearError: () => void
}

export const useCourseStore = create<CourseState>((set, get) => ({
  // Initial state
  courses: [],
  currentCourse: null,
  loading: false,
  error: null,
  academicYear: getCurrentAcademicYear(),

  // Actions
  setAcademicYear: (academicYear) => set({ academicYear }),

  setCurrentCourse: (course) => set({ currentCourse: course }),

  clearError: () => set({ error: null }),

  fetchCourses: async (year?: string) => {
    const targetYear = year ?? get().academicYear
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<CourseSummary[]>>(
        'drive:listCourses',
        targetYear
      )

      if (result.success) {
        set({ courses: result.data, loading: false })
      } else {
        set({ error: result.error, loading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch courses'
      set({ error: message, loading: false })
    }
  },

  createCourse: async (input: CreateCourseInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Course>>(
        'drive:createCourse',
        input
      )

      if (result.success) {
        // Refresh the course list after creating
        const { academicYear } = get()
        const listResult = await window.electronAPI.invoke<ServiceResult<CourseSummary[]>>(
          'drive:listCourses',
          academicYear
        )

        if (listResult.success) {
          set({ courses: listResult.data, loading: false })
        } else {
          set({ loading: false })
        }

        return result.data
      } else {
        set({ error: result.error, loading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create course'
      set({ error: message, loading: false })
      return null
    }
  }
}))
