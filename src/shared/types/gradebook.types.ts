/**
 * Gradebook type definitions
 *
 * Types for displaying and exporting student grades across multiple assessments.
 */

import type { AssessmentType } from './common.types'

/**
 * Grade information for a single assessment
 */
export interface GradeInfo {
  score: number
  totalPoints: number
  percentage: number
  gradedAt: string
}

/**
 * Entry for a single student in the gradebook
 */
export interface GradebookEntry {
  studentId: string
  studentName: string // "Last, First" format
  studentNumber?: string
  grades: Record<string, GradeInfo | null> // assessmentId -> grade info (null = not graded)
  averagePercentage: number | null // null if no grades
}

/**
 * Assessment column information for the gradebook
 */
export interface GradebookAssessment {
  id: string
  title: string
  type: AssessmentType
  totalPoints: number
  assignmentId: string
}

/**
 * Complete gradebook data for a section
 */
export interface Gradebook {
  sectionId: string
  sectionName: string
  courseName: string
  assessments: GradebookAssessment[]
  entries: GradebookEntry[]
  generatedAt: string
}

/**
 * Request to get gradebook for a section
 */
export interface GetGradebookRequest {
  sectionId: string
}

/**
 * Request to export gradebook as CSV
 */
export interface ExportGradebookRequest {
  sectionId: string
  includeStudentNumber?: boolean
}
