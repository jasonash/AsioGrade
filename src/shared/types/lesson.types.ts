/**
 * Lesson type definitions
 *
 * Lessons are created at the unit level and follow Backward Design principles.
 * They contain learning goals, success criteria, and structured components.
 */

import type { Entity } from './common.types'

// Lesson status
export type LessonStatus = 'draft' | 'ready' | 'taught'

// Lesson component types following gradual release of responsibility
export type LessonComponentType =
  | 'bellringer' // Opening activity / warm-up
  | 'objective' // Share learning goals
  | 'direct' // Direct instruction (I do)
  | 'guided' // Guided practice (We do)
  | 'independent' // Independent practice (You do)
  | 'collaborative' // Group work
  | 'check' // Formative check
  | 'closure' // Lesson wrap-up
  | 'extension' // For early finishers

// Lesson material types
export type LessonMaterialType = 'handout' | 'slide' | 'video' | 'link' | 'equipment' | 'other'

/**
 * Learning goal with optional standard alignment
 */
export interface LearningGoal {
  id: string
  text: string // e.g., "Students will be able to explain..."
  standardRef?: string // Optional link to a specific standard
  assessedBy?: string[] // Component IDs that assess this goal
}

/**
 * A single component/section of a lesson
 */
export interface LessonComponent {
  id: string
  type: LessonComponentType
  title: string
  description: string
  estimatedMinutes: number
  order: number

  // Detailed content
  teacherNotes?: string
  studentInstructions?: string

  // Resources for this component
  materials?: string[] // Material IDs or names

  // For formative checks
  assessmentQuestions?: string[] // Question IDs or prompts
}

/**
 * Material/resource for a lesson
 */
export interface LessonMaterial {
  id: string
  name: string
  type: LessonMaterialType
  url?: string // External URL
  driveFileId?: string // Google Drive file reference
  notes?: string
}

/**
 * Universal Design for Learning notes
 */
export interface UDLNotes {
  engagement: string[] // Multiple means of engagement
  representation: string[] // Multiple means of representation
  expression: string[] // Multiple means of action/expression
}

/**
 * Full lesson entity with all components
 */
export interface Lesson extends Entity {
  courseId: string
  unitId: string
  title: string
  description?: string
  order: number
  estimatedMinutes: number

  // Standards alignment
  standardRefs: string[]

  // Backward Design elements
  learningGoals: LearningGoal[]
  successCriteria: string[]

  // Lesson structure
  components: LessonComponent[]

  // Materials
  materials: LessonMaterial[]

  // UDL considerations
  udlNotes?: UDLNotes

  // Metadata
  status: LessonStatus
  aiGenerated: boolean
}

/**
 * Lightweight lesson summary for list views
 */
export interface LessonSummary {
  id: string
  unitId: string
  title: string
  estimatedMinutes: number
  componentCount: number
  goalCount: number
  status: LessonStatus
  aiGenerated: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Input for creating a new lesson
 */
export interface CreateLessonInput {
  courseId: string
  unitId: string
  title: string
  description?: string
  estimatedMinutes: number
  standardRefs?: string[]
  learningGoals?: LearningGoal[]
  successCriteria?: string[]
  components?: LessonComponent[]
  materials?: LessonMaterial[]
}

/**
 * Input for updating a lesson
 */
export interface UpdateLessonInput {
  id: string
  courseId: string
  unitId: string
  title?: string
  description?: string
  order?: number
  estimatedMinutes?: number
  standardRefs?: string[]
  learningGoals?: LearningGoal[]
  successCriteria?: string[]
  components?: LessonComponent[]
  materials?: LessonMaterial[]
  udlNotes?: UDLNotes
  status?: LessonStatus
  aiGenerated?: boolean
}

/**
 * Input for reordering lessons within a unit
 */
export interface ReorderLessonsInput {
  unitId: string
  lessonIds: string[] // Ordered array of lesson IDs
}

// ============================================
// Unit Materials Types
// ============================================

// Unit material file types
export type UnitMaterialType = 'pdf' | 'docx' | 'txt' | 'other'

/**
 * A teaching material uploaded to a unit
 * Used as AI context for question/lesson generation
 */
export interface UnitMaterial {
  id: string
  unitId: string
  name: string
  type: UnitMaterialType
  driveFileId: string
  extractedText?: string // Cached text for AI context
  uploadedAt: string
}

/**
 * Summary of unit material for list views
 */
export interface UnitMaterialSummary {
  id: string
  name: string
  type: UnitMaterialType
  uploadedAt: string
}

/**
 * Input for uploading a unit material
 */
export interface UploadUnitMaterialInput {
  unitId: string
  courseId: string
  filePath: string
  name: string
}

// ============================================
// Component Type Labels and Icons
// ============================================

/**
 * Display labels for lesson component types
 */
export const COMPONENT_TYPE_LABELS: Record<LessonComponentType, string> = {
  bellringer: 'Bellringer',
  objective: 'Objectives',
  direct: 'Direct Instruction',
  guided: 'Guided Practice',
  independent: 'Independent Practice',
  collaborative: 'Collaborative Work',
  check: 'Formative Check',
  closure: 'Closure',
  extension: 'Extension'
}

/**
 * Emoji icons for lesson component types
 */
export const COMPONENT_TYPE_ICONS: Record<LessonComponentType, string> = {
  bellringer: '🔔',
  objective: '🎯',
  direct: '📖',
  guided: '🤝',
  independent: '✏️',
  collaborative: '👥',
  check: '✅',
  closure: '🏁',
  extension: '🚀'
}

/**
 * Default time allocations for component types (in minutes)
 */
export const COMPONENT_DEFAULT_MINUTES: Record<LessonComponentType, number> = {
  bellringer: 5,
  objective: 2,
  direct: 15,
  guided: 12,
  independent: 12,
  collaborative: 10,
  check: 5,
  closure: 4,
  extension: 5
}
