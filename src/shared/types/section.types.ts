/**
 * Section type definitions
 * A Section represents a group of students - who you teach
 */

import { Entity } from './common.types'

export interface Section extends Entity {
  courseId: string // Links to parent course
  name: string // "Period 1", "Block A", etc.
  schedule?: string // "MWF 8:00-8:50"
  room?: string // "Room 204"

  // Drive folder ID for this section
  driveFolderId?: string
}

// Summary for listing sections (lighter weight)
export interface SectionSummary {
  id: string
  courseId: string
  name: string
  studentCount: number
  schedule?: string
  room?: string
  driveFolderId?: string
}

// Input for creating a new section
export interface CreateSectionInput {
  courseId: string
  name: string
  schedule?: string
  room?: string
}

// Input for updating a section
export interface UpdateSectionInput {
  id: string
  name?: string
  schedule?: string
  room?: string
}
