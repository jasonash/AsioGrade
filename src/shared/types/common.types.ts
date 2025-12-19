/**
 * Common type definitions shared across the application
 */

// Result type for service operations
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

export type ServiceResult<T> = Result<T, string>

// Base interfaces for entities
export interface Timestamps {
  createdAt: string
  updatedAt: string
}

export interface Versioned {
  version: number
}

export interface Entity extends Timestamps, Versioned {
  id: string
}

// Academic year format: "2024-2025"
export type AcademicYear = string

// Assessment types
export type AssessmentType = 'test' | 'quiz' | 'exam' | 'benchmark' | 'pretest' | 'exit_ticket'

// Assessment purpose
export type AssessmentPurpose = 'formative' | 'summative'

// Assignment status
export type AssignmentStatus = 'draft' | 'assigned' | 'collecting' | 'grading' | 'graded'
