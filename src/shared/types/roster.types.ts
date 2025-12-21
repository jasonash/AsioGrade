/**
 * Roster and Student type definitions
 * Students can only be in one section per course
 */

import type { Timestamps } from './common.types'

export interface Student extends Timestamps {
  id: string
  firstName: string
  lastName: string
  email?: string
  studentNumber?: string // School-assigned ID
  notes?: string // Teacher's private notes
  active: boolean
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
}
