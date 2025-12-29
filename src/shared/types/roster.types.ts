/**
 * Roster and Student type definitions
 * Students can only be in one section per course
 */

import type { Timestamps } from './common.types'

/**
 * Webb's Depth of Knowledge levels (1-4)
 * Used to differentiate instruction and assessment complexity
 */
export type DOKLevel = 1 | 2 | 3 | 4

export const DOK_LABELS: Record<DOKLevel, string> = {
  1: 'Recall',
  2: 'Skill/Concept',
  3: 'Strategic Thinking',
  4: 'Extended Thinking'
}

export const DOK_DESCRIPTIONS: Record<DOKLevel, string> = {
  1: 'Basic recall of facts, terms, procedures',
  2: 'Use of skills, concepts, and procedures',
  3: 'Reasoning, planning, using evidence',
  4: 'Complex reasoning over extended time'
}

export const DOK_LEVELS: DOKLevel[] = [1, 2, 3, 4]

export interface Student extends Timestamps {
  id: string
  firstName: string
  lastName: string
  email?: string
  studentNumber?: string // School-assigned ID
  notes?: string // Teacher's private notes
  active: boolean
  dokLevel: DOKLevel // Webb's DOK level (default: 2)
}

export interface Roster {
  sectionId: string
  version: number
  updatedAt: string
  students: Student[]
}

// Input for creating a new student
export interface CreateStudentInput {
  firstName: string
  lastName: string
  email?: string
  studentNumber?: string
  notes?: string
  dokLevel?: DOKLevel // Optional, defaults to 2
}

// Input for updating a student
export interface UpdateStudentInput {
  id: string
  firstName?: string
  lastName?: string
  email?: string
  studentNumber?: string
  notes?: string
  active?: boolean
  dokLevel?: DOKLevel
}
