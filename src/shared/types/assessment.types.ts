/**
 * Assessment type definitions
 *
 * Assessments are created at the course/unit level and contain questions.
 * They can later be assigned to sections as assignments.
 */

import { Entity, AssessmentType, AssessmentPurpose } from './common.types'
import { Question } from './question.types'

// Assessment status
export type AssessmentStatus = 'draft' | 'published'

/**
 * Full assessment entity with all questions
 */
export interface Assessment extends Entity {
  courseId: string
  unitId?: string // Optional - assessments can exist without a unit
  type: AssessmentType
  title: string
  description?: string
  purpose: AssessmentPurpose
  questions: Question[]
  status: AssessmentStatus
  publishedAt?: string

  // Placeholders for future features (deferred)
  // variants?: AssessmentVariants
  // versions?: TestVersions
}

/**
 * Lightweight assessment summary for list views
 */
export interface AssessmentSummary {
  id: string
  unitId?: string
  type: AssessmentType
  title: string
  purpose: AssessmentPurpose
  questionCount: number
  totalPoints: number
  status: AssessmentStatus
  createdAt: string
  updatedAt: string
}

/**
 * Input for creating a new assessment
 */
export interface CreateAssessmentInput {
  courseId: string
  unitId?: string
  type: AssessmentType
  title: string
  description?: string
  purpose: AssessmentPurpose
  questions?: Question[] // Can start empty
}

/**
 * Input for updating an assessment
 */
export interface UpdateAssessmentInput {
  id: string
  courseId: string
  unitId?: string
  type?: AssessmentType
  title?: string
  description?: string
  purpose?: AssessmentPurpose
  questions?: Question[]
  status?: AssessmentStatus
}

// Re-export common types for convenience
export { AssessmentType, AssessmentPurpose } from './common.types'
