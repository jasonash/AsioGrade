/**
 * Grade type definitions for the grading engine
 *
 * Types for processing scantrons, storing grades, and analyzing results.
 */

import type { QuestionType } from './question.types'
import type { VersionId } from './assignment.types'
import type { ResolvedScantronData } from './scantron.types'

// ============================================================
// Grade Flag Types
// ============================================================

/**
 * Types of flags that can be raised during grading
 */
export type GradeFlagType =
  | 'multiple_bubbles'
  | 'no_answer'
  | 'qr_error'
  | 'variant_mismatch'
  | 'low_confidence'
  | 'student_not_found'

/**
 * Flag indicating an issue with a graded answer
 */
export interface GradeFlag {
  type: GradeFlagType
  questionNumber?: number
  message: string
}

// ============================================================
// Answer Result Types
// ============================================================

/**
 * Result for a single question in a grade record
 */
export interface AnswerResult {
  questionNumber: number
  questionId: string
  questionType: QuestionType
  selected: string | string[] | boolean | number | null
  confidence: number
  correct: boolean
  partialCredit?: number
  multipleSelected: boolean
  unclear: boolean
}

// ============================================================
// Grade Record Types
// ============================================================

/**
 * Complete grade record for a single student
 */
export interface GradeRecord {
  id: string
  studentId: string
  assignmentId: string
  variantId?: string
  versionId: VersionId

  gradedAt: string
  scannedAt: string

  rawScore: number
  totalQuestions: number
  percentage: number
  points: number
  maxPoints: number

  answers: AnswerResult[]

  flags: GradeFlag[]
  needsReview: boolean
  reviewNotes?: string

  scantronPageNumber: number
  scantronFileId?: string
}

/**
 * Lightweight grade record for list views
 */
export interface GradeRecordSummary {
  id: string
  studentId: string
  rawScore: number
  totalQuestions: number
  percentage: number
  needsReview: boolean
  flagCount: number
}

// ============================================================
// Grade Statistics Types
// ============================================================

/**
 * Statistics for variant-level analysis
 */
export interface VariantStats {
  count: number
  average: number
}

/**
 * Statistics for question-level analysis
 */
export interface QuestionStats {
  correctCount: number
  incorrectCount: number
  skippedCount: number
  percentCorrect: number
}

/**
 * Statistics for standard-level analysis
 */
export interface StandardStats {
  questionCount: number
  averageCorrect: number
}

/**
 * Aggregate statistics for an assignment's grades
 */
export interface GradeStats {
  totalStudents: number
  averageScore: number
  medianScore: number
  highScore: number
  lowScore: number
  standardDeviation: number

  byVariant: Record<string, VariantStats>
  byQuestion: Record<string, QuestionStats>
  byStandard: Record<string, StandardStats>
}

// ============================================================
// Assignment Grades Container
// ============================================================

/**
 * Container for all grades for an assignment
 * Stored in: sections/{sectionId}/grades/{assignmentId}-grades.json
 */
export interface AssignmentGrades {
  assignmentId: string
  sectionId: string
  assessmentId: string
  gradedAt: string

  records: GradeRecord[]
  stats: GradeStats
}

// ============================================================
// Bubble Detection Types
// ============================================================

/**
 * Detection result for a single bubble
 */
export interface BubbleDetection {
  id: string // 'A', 'B', 'C', 'D'
  filled: boolean
  confidence: number
  x: number
  y: number
  radius: number
  fillPercentage: number
}

/**
 * Detection result for a single question (all 4 bubbles)
 */
export interface DetectedBubble {
  questionNumber: number
  row: number
  column: number
  bubbles: BubbleDetection[]
  selected: string | null // 'A', 'B', 'C', 'D', or null
  multipleDetected: boolean
}

// ============================================================
// Parsed Scantron Types
// ============================================================

/**
 * Result of parsing a single scantron page
 * Note: qrData now uses ResolvedScantronData which normalizes v1/v2/v3 QR formats
 */
export interface ParsedScantron {
  pageNumber: number
  success: boolean
  qrData: ResolvedScantronData | null
  qrError?: string
  ocrStudentName?: string // OCR-extracted student name (used when QR fails)
  answers: DetectedBubble[]
  confidence: number
  processingTimeMs: number
  flags: string[]
  imageWidth: number
  imageHeight: number
}

// ============================================================
// Page Classification Types (Phase 4: Never skip pages)
// ============================================================

/**
 * Classification of a scanned page
 */
export type PageType =
  | 'valid_scantron' // Has registration marks + readable QR
  | 'unidentified_scantron' // Has registration marks, QR unreadable
  | 'blank_page' // No marks, no content
  | 'unknown_document' // Has content but not a scantron

/**
 * An unidentified scantron page that needs manual student assignment
 * These are pages where the QR code couldn't be read but the page
 * appears to be a valid scantron (has registration marks and bubbles)
 */
export interface UnidentifiedPage {
  pageNumber: number
  pageType: PageType
  confidence: number
  detectedAnswers: DetectedBubble[] // We still try to read the answers
  registrationMarkCount: number
  imageDataBase64?: string // Optional: image preview for review UI
  possibleStudents?: string[] // Optional: list of student IDs who haven't been graded yet
  suggestedStudents?: string[] // OCR-matched student IDs (best matches first)
  ocrStudentName?: string // Raw OCR text from the name field
  qrError?: string
}

// ============================================================
// Progress Event Types
// ============================================================

/**
 * Progress event sent during scantron processing
 */
export interface GradeProgressEvent {
  stage: 'extracting' | 'parsing' | 'grading' | 'complete'
  currentPage: number
  totalPages: number
  message: string
}

// ============================================================
// IPC Request/Response Types
// ============================================================

/**
 * Request to process a scantron PDF
 */
export interface GradeProcessRequest {
  assignmentId: string
  sectionId: string
  pdfBase64: string // Base64 encoded PDF file
}

/**
 * Answer key entry for grading
 */
export interface AnswerKeyEntry {
  questionNumber: number
  questionId: string
  correctAnswer: string
  points: number
}

/**
 * Result of processing a scantron PDF
 */
export interface GradeProcessResult {
  success: boolean
  error?: string
  parsedPages: ParsedScantron[]
  grades?: AssignmentGrades
  flaggedRecords: GradeRecord[]
  unidentifiedPages: UnidentifiedPage[] // IMPORTANT: Never skip pages - include them here
  answerKey: AnswerKeyEntry[] // Answer key for grading manually assigned pages
  processingTimeMs: number
  summary: {
    totalPages: number
    identifiedPages: number
    unidentifiedPages: number
    blankPages: number
    unknownDocuments: number
  }
}

/**
 * Override for a single answer in a grade record
 */
export interface GradeOverride {
  recordId: string
  questionNumber: number
  newAnswer: string | null
  reason?: string
}

/**
 * Request to save grades to Google Drive
 */
export interface SaveGradesInput {
  assignmentId: string
  sectionId: string
  grades: AssignmentGrades
  overrides?: GradeOverride[]
}

// ============================================================
// Bubble Detection Options
// ============================================================

/**
 * Options for bubble detection algorithm
 */
export interface BubbleDetectionOptions {
  minRadius?: number // Minimum bubble radius in pixels
  maxRadius?: number // Maximum bubble radius in pixels
  fillThreshold?: number // Fill percentage threshold (0-1, default 0.4)
  confidenceThreshold?: number // Confidence threshold for flagging (0-1, default 0.7)
}

// Re-export ScantronQRData for convenience
export type { ScantronQRData } from './scantron.types'
