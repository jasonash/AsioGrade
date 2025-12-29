/**
 * Assessment type definitions
 *
 * Assessments are created at the course level and contain questions.
 * They can later be assigned to sections as assignments.
 */

import type { Entity, AssessmentType, AssessmentPurpose } from './common.types'
import type { Question } from './question.types'
import type { DOKLevel } from './roster.types'
import type { VersionId } from './assignment.types'

// Assessment status
export type AssessmentStatus = 'draft' | 'published'

// DOK-based variant strategy
export type VariantStrategy = 'questions' | 'distractors'

/**
 * A randomized version of an assessment
 * Contains the shuffled order of questions and choices
 */
export interface AssessmentVersion {
  versionId: VersionId
  questionOrder: string[] // Question IDs in shuffled order
  choiceOrders: Record<string, string[]> // questionId -> choice IDs in shuffled order
}

/**
 * Answer key entry for a specific randomized version
 * (Different from AnswerKeyEntry in grade.types.ts which is for grading)
 */
export interface VersionAnswerKeyEntry {
  questionNumber: number // 1-indexed position in this version
  questionId: string
  correctChoiceId: string // Original choice ID (e.g., 'a', 'b', 'c', 'd')
  correctLetter: string // Letter in this version (e.g., 'A', 'B', 'C', 'D')
}

/**
 * A DOK-based variant of an assessment
 * Contains questions adjusted for a specific DOK level
 */
export interface AssessmentVariant {
  id: string
  assessmentId: string
  dokLevel: DOKLevel
  strategy: VariantStrategy
  questions: Question[]
  createdAt: string
}

/**
 * Full assessment entity with all questions
 */
export interface Assessment extends Entity {
  courseId: string
  type: AssessmentType
  title: string
  description?: string
  purpose: AssessmentPurpose
  questions: Question[]
  status: AssessmentStatus
  publishedAt?: string

  // DOK-based variants (Phase 5)
  variants?: AssessmentVariant[]

  // Randomized versions A/B/C/D (Phase 6)
  versions?: AssessmentVersion[]
}

/**
 * Lightweight assessment summary for list views
 */
export interface AssessmentSummary {
  id: string
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
  type?: AssessmentType
  title?: string
  description?: string
  purpose?: AssessmentPurpose
  questions?: Question[]
  status?: AssessmentStatus
  variants?: AssessmentVariant[]
  versions?: AssessmentVersion[]
}

// Re-export common types for convenience
export type { AssessmentType, AssessmentPurpose } from './common.types'
