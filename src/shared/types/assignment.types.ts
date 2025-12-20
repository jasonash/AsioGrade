/**
 * Assignment type definitions
 *
 * Assignments link a published assessment to a section,
 * tracking when it was given and individual student assignments.
 */

import type { Entity, AssignmentStatus, AssessmentType, AssessmentPurpose } from './common.types'

/**
 * Version ID for test versions (A/B/C/D)
 * For now, all students get version 'A'
 */
export type VersionId = 'A' | 'B' | 'C' | 'D'

/**
 * Student-specific assignment record
 */
export interface StudentAssignment {
  studentId: string
  variantId?: string // null = base assessment (for future UDL support)
  versionId: VersionId // Always 'A' for now
}

/**
 * Full assignment entity
 */
export interface Assignment extends Entity {
  sectionId: string
  assessmentId: string
  unitId: string // Denormalized for grading lookup
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
  unitId: string // Denormalized for grading lookup
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
}
