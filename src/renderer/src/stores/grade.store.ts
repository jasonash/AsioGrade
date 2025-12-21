import { create } from 'zustand'
import type {
  AssignmentGrades,
  GradeRecord,
  GradeOverride,
  GradeStats,
  ParsedScantron,
  GradeProcessRequest,
  GradeProcessResult,
  SaveGradesInput,
  UnidentifiedPage,
  VersionId,
  AnswerResult,
  AnswerKeyEntry,
  GradeProgressEvent
} from '../../../shared/types'
import type { ServiceResult } from '../../../shared/types/common.types'

/**
 * Calculate stats for merged grade records
 */
function calculateMergedStats(records: GradeRecord[]): GradeStats {
  if (records.length === 0) {
    return {
      totalStudents: 0,
      averageScore: 0,
      medianScore: 0,
      highScore: 0,
      lowScore: 0,
      standardDeviation: 0,
      byVariant: {},
      byQuestion: {},
      byStandard: {}
    }
  }

  const percentages = records.map((r) => r.percentage)
  const sorted = [...percentages].sort((a, b) => a - b)

  const sum = percentages.reduce((a, b) => a + b, 0)
  const average = sum / percentages.length
  const median =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]

  const squaredDiffs = percentages.map((p) => Math.pow(p - average, 2))
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / percentages.length
  const stdDev = Math.sqrt(avgSquaredDiff)

  // Calculate by-question stats
  const byQuestion: Record<string, { correctCount: number; incorrectCount: number; skippedCount: number; percentCorrect: number }> = {}
  for (const record of records) {
    for (const answer of record.answers) {
      const qNum = String(answer.questionNumber)
      if (!byQuestion[qNum]) {
        byQuestion[qNum] = { correctCount: 0, incorrectCount: 0, skippedCount: 0, percentCorrect: 0 }
      }
      if (answer.selected === null) {
        byQuestion[qNum].skippedCount++
      } else if (answer.correct) {
        byQuestion[qNum].correctCount++
      } else {
        byQuestion[qNum].incorrectCount++
      }
    }
  }
  // Calculate percentCorrect for each question
  for (const qNum of Object.keys(byQuestion)) {
    const q = byQuestion[qNum]
    const total = q.correctCount + q.incorrectCount + q.skippedCount
    q.percentCorrect = total > 0 ? (q.correctCount / total) * 100 : 0
  }

  return {
    totalStudents: records.length,
    averageScore: Math.round(average * 100) / 100,
    medianScore: Math.round(median * 100) / 100,
    highScore: Math.max(...percentages),
    lowScore: Math.min(...percentages),
    standardDeviation: Math.round(stdDev * 100) / 100,
    byVariant: {},
    byQuestion,
    byStandard: {}
  }
}

interface GradeState {
  // State
  currentGrades: AssignmentGrades | null
  parsedPages: ParsedScantron[]
  flaggedRecords: GradeRecord[]
  unidentifiedPages: UnidentifiedPage[]
  answerKey: AnswerKeyEntry[] // Answer key for grading manually assigned pages
  processingProgress: number
  progressEvent: GradeProgressEvent | null
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
  answerKey: [],
  processingProgress: 0,
  progressEvent: null,
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
      answerKey: [],
      pendingOverrides: [],
      processingProgress: 0,
      progressEvent: null,
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
      progressEvent: null,
      currentAssignmentId: request.assignmentId,
      currentSectionId: request.sectionId
    })

    // Subscribe to progress events
    const unsubscribe = window.electronAPI.on('grade:progress', (event: unknown) => {
      const progress = event as GradeProgressEvent
      set({ progressEvent: progress })
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

      // Fetch existing grades to merge with new ones
      const existingResult = await window.electronAPI.invoke<ServiceResult<AssignmentGrades | null>>(
        'grade:getGrades',
        request.assignmentId,
        request.sectionId
      )

      let mergedGrades = result.data.grades
      let mergedFlagged = result.data.flaggedRecords

      // If we have existing grades and new grades, merge them
      if (existingResult.success && existingResult.data && result.data.grades) {
        const existingRecords = existingResult.data.records
        const newRecords = result.data.grades.records

        // Create a map of existing records by studentId for quick lookup
        const recordMap = new Map<string, GradeRecord>()

        // Add all existing records to the map
        for (const record of existingRecords) {
          recordMap.set(record.studentId, record)
        }

        // Overwrite/add with new records (new scans take priority)
        for (const record of newRecords) {
          recordMap.set(record.studentId, record)
        }

        // Convert map back to array
        const mergedRecords = Array.from(recordMap.values())

        // Recalculate stats for merged records
        const stats = calculateMergedStats(mergedRecords)

        mergedGrades = {
          ...result.data.grades,
          records: mergedRecords,
          stats
        }

        // Update flagged records from the merged set
        mergedFlagged = mergedRecords.filter((r) => r.needsReview)
      }

      set({
        currentGrades: mergedGrades || null,
        parsedPages: result.data.parsedPages,
        flaggedRecords: mergedFlagged,
        unidentifiedPages: result.data.unidentifiedPages || [],
        answerKey: result.data.answerKey || [],
        isProcessing: false,
        processingProgress: 100
      })
      return result.data
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process scantron'
      set({ error: message, isProcessing: false, processingProgress: 0, progressEvent: null })
      return null
    } finally {
      // Always unsubscribe from progress events
      unsubscribe()
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
    const { currentGrades, unidentifiedPages, currentAssignmentId, parsedPages, answerKey } = get()

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

    // Build a lookup map from the answer key for efficient grading
    const answerKeyMap = new Map(
      answerKey.map((entry) => [entry.questionNumber, entry])
    )

    // Create answer results from detected answers and grade them
    let rawScore = 0
    let totalPoints = 0
    const answers: AnswerResult[] = page.detectedAnswers.map((bubble) => {
      const maxConfidence = Math.max(...bubble.bubbles.map((b) => b.confidence))
      const keyEntry = answerKeyMap.get(bubble.questionNumber)
      const correctAnswer = keyEntry?.correctAnswer?.toUpperCase()
      const selectedAnswer = bubble.selected?.toUpperCase() ?? null
      const isCorrect = selectedAnswer === correctAnswer

      // Accumulate score
      if (isCorrect) {
        rawScore++
      }
      totalPoints += keyEntry?.points || 1

      return {
        questionNumber: bubble.questionNumber,
        questionId: keyEntry?.questionId || '',
        questionType: 'multiple_choice' as const,
        selected: bubble.selected,
        confidence: maxConfidence,
        correct: isCorrect,
        multipleSelected: bubble.multipleDetected,
        unclear: maxConfidence < 0.7
      }
    })

    // Calculate percentage
    const totalQuestions = page.detectedAnswers.length
    const percentage = totalQuestions > 0 ? (rawScore / totalQuestions) * 100 : 0

    // Create a new grade record with actual scores
    const newRecord: GradeRecord = {
      id: `${currentAssignmentId}-${studentId}`,
      studentId,
      assignmentId: currentAssignmentId,
      versionId: 'A' as VersionId,
      gradedAt: new Date().toISOString(),
      scannedAt: new Date().toISOString(),
      rawScore,
      totalQuestions,
      percentage,
      points: rawScore,
      maxPoints: totalPoints,
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
