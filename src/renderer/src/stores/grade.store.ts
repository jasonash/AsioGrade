import { create } from 'zustand'
import type {
  AssignmentGrades,
  GradeRecord,
  GradeOverride,
  ParsedScantron,
  GradeProcessRequest,
  GradeProcessResult,
  SaveGradesInput,
  UnidentifiedPage,
  VersionId,
  AnswerResult
} from '../../../shared/types'
import type { ServiceResult } from '../../../shared/types/common.types'

interface GradeState {
  // State
  currentGrades: AssignmentGrades | null
  parsedPages: ParsedScantron[]
  flaggedRecords: GradeRecord[]
  unidentifiedPages: UnidentifiedPage[]
  processingProgress: number
  isProcessing: boolean
  isSaving: boolean
  error: string | null

  // Pending overrides (before save)
  pendingOverrides: GradeOverride[]

  // Current context
  currentAssignmentId: string | null
  currentSectionId: string | null

  // Actions
  processScantron: (request: GradeProcessRequest) => Promise<GradeProcessResult | null>
  fetchGrades: (assignmentId: string, sectionId: string) => Promise<AssignmentGrades | null>
  saveGrades: () => Promise<boolean>
  addOverride: (override: GradeOverride) => void
  removeOverride: (recordId: string, questionNumber: number) => void
  clearOverrides: () => void
  setCurrentGrades: (grades: AssignmentGrades | null) => void
  setContext: (assignmentId: string, sectionId: string) => void
  clearGrades: () => void
  clearError: () => void
  assignUnidentifiedPage: (pageNumber: number, studentId: string) => void
}

export const useGradeStore = create<GradeState>((set, get) => ({
  // Initial state
  currentGrades: null,
  parsedPages: [],
  flaggedRecords: [],
  unidentifiedPages: [],
  processingProgress: 0,
  isProcessing: false,
  isSaving: false,
  error: null,
  pendingOverrides: [],
  currentAssignmentId: null,
  currentSectionId: null,

  // Actions
  setContext: (assignmentId, sectionId) =>
    set({ currentAssignmentId: assignmentId, currentSectionId: sectionId }),

  setCurrentGrades: (grades) => set({ currentGrades: grades }),

  clearError: () => set({ error: null }),

  clearOverrides: () => set({ pendingOverrides: [] }),

  clearGrades: () =>
    set({
      currentGrades: null,
      parsedPages: [],
      flaggedRecords: [],
      unidentifiedPages: [],
      pendingOverrides: [],
      processingProgress: 0,
      error: null
    }),

  addOverride: (override) => {
    const { pendingOverrides } = get()
    // Remove any existing override for the same record/question
    const filtered = pendingOverrides.filter(
      (o) => !(o.recordId === override.recordId && o.questionNumber === override.questionNumber)
    )
    set({ pendingOverrides: [...filtered, override] })
  },

  removeOverride: (recordId, questionNumber) => {
    const { pendingOverrides } = get()
    const filtered = pendingOverrides.filter(
      (o) => !(o.recordId === recordId && o.questionNumber === questionNumber)
    )
    set({ pendingOverrides: filtered })
  },

  processScantron: async (request: GradeProcessRequest) => {
    set({
      isProcessing: true,
      error: null,
      processingProgress: 0,
      currentAssignmentId: request.assignmentId,
      currentSectionId: request.sectionId
    })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<GradeProcessResult>>(
        'grade:processScantron',
        request
      )

      if (!result.success) {
        set({
          error: result.error || 'Failed to process scantron',
          isProcessing: false,
          processingProgress: 0
        })
        return null
      }

      set({
        currentGrades: result.data.grades || null,
        parsedPages: result.data.parsedPages,
        flaggedRecords: result.data.flaggedRecords,
        unidentifiedPages: result.data.unidentifiedPages || [],
        isProcessing: false,
        processingProgress: 100
      })
      return result.data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process scantron'
      set({ error: message, isProcessing: false, processingProgress: 0 })
      return null
    }
  },

  fetchGrades: async (assignmentId: string, sectionId: string) => {
    set({
      isProcessing: true,
      error: null,
      currentAssignmentId: assignmentId,
      currentSectionId: sectionId
    })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<AssignmentGrades | null>>(
        'grade:getGrades',
        assignmentId,
        sectionId
      )

      if (result.success) {
        if (result.data) {
          const flagged = result.data.records.filter((r) => r.needsReview)
          set({
            currentGrades: result.data,
            flaggedRecords: flagged,
            isProcessing: false
          })
        } else {
          set({
            currentGrades: null,
            flaggedRecords: [],
            isProcessing: false
          })
        }
        return result.data
      } else {
        set({ error: result.error, isProcessing: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch grades'
      set({ error: message, isProcessing: false })
      return null
    }
  },

  saveGrades: async () => {
    const { currentGrades, pendingOverrides, currentAssignmentId, currentSectionId } = get()

    if (!currentGrades || !currentAssignmentId || !currentSectionId) {
      set({ error: 'No grades to save' })
      return false
    }

    set({ isSaving: true, error: null })

    try {
      const input: SaveGradesInput = {
        assignmentId: currentAssignmentId,
        sectionId: currentSectionId,
        grades: currentGrades,
        overrides: pendingOverrides.length > 0 ? pendingOverrides : undefined
      }

      const result = await window.electronAPI.invoke<ServiceResult<AssignmentGrades>>(
        'grade:saveGrades',
        input
      )

      if (result.success) {
        // Update with the saved grades (which may have overrides applied)
        const flagged = result.data.records.filter((r) => r.needsReview)
        set({
          currentGrades: result.data,
          flaggedRecords: flagged,
          pendingOverrides: [], // Clear overrides after successful save
          isSaving: false
        })
        return true
      } else {
        set({ error: result.error, isSaving: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save grades'
      set({ error: message, isSaving: false })
      return false
    }
  },

  assignUnidentifiedPage: (pageNumber: number, studentId: string) => {
    const { currentGrades, unidentifiedPages, currentAssignmentId, parsedPages } = get()

    if (!currentGrades || !currentAssignmentId) {
      set({ error: 'No grades context available' })
      return
    }

    // Find the unidentified page
    const page = unidentifiedPages.find((p) => p.pageNumber === pageNumber)
    if (!page) {
      set({ error: `Unidentified page ${pageNumber} not found` })
      return
    }

    // Find the parsed page data for answer details
    const parsedPage = parsedPages.find((p) => p.pageNumber === pageNumber)

    // Create answer results from detected answers
    const answers: AnswerResult[] = page.detectedAnswers.map((bubble) => {
      const maxConfidence = Math.max(...bubble.bubbles.map((b) => b.confidence))
      return {
        questionNumber: bubble.questionNumber,
        questionId: '', // Will be filled by grading calculation
        questionType: 'multiple_choice' as const,
        selected: bubble.selected,
        confidence: maxConfidence,
        correct: false, // Will be recalculated when compared with answer key
        multipleSelected: bubble.multipleDetected,
        unclear: maxConfidence < 0.7
      }
    })

    // Create a new grade record
    const newRecord: GradeRecord = {
      id: `${currentAssignmentId}-${studentId}`,
      studentId,
      assignmentId: currentAssignmentId,
      versionId: 'A' as VersionId,
      gradedAt: new Date().toISOString(),
      scannedAt: new Date().toISOString(),
      rawScore: 0, // Will be recalculated
      totalQuestions: page.detectedAnswers.length,
      percentage: 0, // Will be recalculated
      points: 0, // Will be recalculated
      maxPoints: page.detectedAnswers.length,
      answers,
      flags: [
        {
          type: 'qr_error',
          message: 'QR code was unreadable - manually assigned'
        }
      ],
      needsReview: true,
      reviewNotes: `Manually assigned from page ${pageNumber}${page.ocrStudentName ? ` (OCR: "${page.ocrStudentName}")` : ''}`,
      scantronPageNumber: pageNumber
    }

    // Update state: add record, remove from unidentified
    const updatedRecords = [...currentGrades.records, newRecord]
    const updatedUnidentified = unidentifiedPages.filter((p) => p.pageNumber !== pageNumber)

    // Update parsed page to mark it as assigned
    const updatedParsedPages = parsedPages.map((p) => {
      if (p.pageNumber === pageNumber && parsedPage) {
        return {
          ...p,
          qrData: { v: 1 as const, aid: currentAssignmentId, sid: studentId },
          qrError: undefined,
          success: true
        }
      }
      return p
    })

    // Recalculate stats
    const newStats = {
      ...currentGrades.stats,
      totalStudents: updatedRecords.length
    }

    set({
      currentGrades: {
        ...currentGrades,
        records: updatedRecords,
        stats: newStats
      },
      unidentifiedPages: updatedUnidentified,
      parsedPages: updatedParsedPages,
      flaggedRecords: updatedRecords.filter((r) => r.needsReview)
    })
  }
}))
