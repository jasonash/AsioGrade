/**
 * Course type definitions
 * A Course represents curriculum - what you teach
 */

import { Entity } from './common.types'

export interface Course extends Entity {
  name: string // "Earth/Space Science"
  subject: string // "Science"
  gradeLevel: string // "6" or "6-8"
  description?: string
  academicYear: string // "2024-2025"

  // For future sharing feature
  ownerId: string
  collaboratorIds?: string[]

  // Drive folder ID for this course
  driveFolderId?: string
}

// Summary for listing courses (lighter weight)
export interface CourseSummary {
  id: string
  name: string
  subject: string
  gradeLevel: string
  academicYear: string
  sectionCount: number
  lastModified: number
  driveFolderId: string
}

// Input for creating a new course
export interface CreateCourseInput {
  name: string
  subject: string
  gradeLevel: string
  description?: string
  academicYear: string
}

// Input for updating a course
export interface UpdateCourseInput {
  id: string
  name?: string
  subject?: string
  gradeLevel?: string
  description?: string
}
