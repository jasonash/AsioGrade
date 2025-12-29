/**
 * Assignment type definitions
 *
 * Assignments link a published assessment to a section,
 * tracking when it was given and individual student assignments.
 */

import type { Entity, AssignmentStatus, AssessmentType, AssessmentPurpose } from './common.types'
import type { DOKLevel } from './roster.types'

/**
 * Version ID for test versions (A/B/C/D)
 */
export type VersionId = 'A' | 'B' | 'C' | 'D'

/**
 * Version assignment strategy
 * - 'single': All students get the same version (default: A)
 * - 'random': Randomly distribute versions across students
 * - 'sequential': Assign A, B, C, D, A, B, C, D... in order
 */
export type VersionAssignmentStrategy = 'single' | 'random' | 'sequential'

/**
 * Student-specific assignment record
 */
export interface StudentAssignment {
  studentId: string
  variantId?: string // null = base assessment (for future UDL support)
  versionId: VersionId // Test version (A/B/C/D)
  dokOverride?: DOKLevel // Override roster DOK for this assessment (optional)
}

/**
 * Full assignment entity
 */
export interface Assignment extends Entity {
  sectionId: string
  assessmentId: string
  assessmentTitle: string // Denormalized for display
  assessmentType: AssessmentType // Denormalized for display
  assessmentPurpose: AssessmentPurpose // Denormalized for display
  questionCount: number // Denormalized for display

  assignedDate?: string // ISO date when assigned
  dueDate?: string // ISO date when due
  status: AssignmentStatus

  studentAssignments: StudentAssignment[]
}

/**
 * Lightweight assignment summary for list views
 */
export interface AssignmentSummary {
  id: string
  sectionId: string
  assessmentId: string
  assessmentTitle: string
  assessmentType: AssessmentType
  assessmentPurpose: AssessmentPurpose
  questionCount: number
  assignedDate?: string
  dueDate?: string
  status: AssignmentStatus
  studentCount: number
  createdAt: string
  updatedAt: string
}

/**
 * Input for creating a new assignment
 */
export interface CreateAssignmentInput {
  sectionId: string
  assessmentId: string
  assignedDate?: string
  dueDate?: string
}

/**
 * Input for updating an assignment
 */
export interface UpdateAssignmentInput {
  id: string
  sectionId: string
  assignedDate?: string
  dueDate?: string
  status?: AssignmentStatus
  studentAssignments?: StudentAssignment[] // For DOK overrides and version assignment
}
