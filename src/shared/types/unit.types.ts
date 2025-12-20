/**
 * Unit type definitions
 * A Unit is a curriculum unit within a course (e.g., "Plate Tectonics")
 * Units serve as the organizational backbone for assessments and standards alignment
 */

import { Entity } from './common.types'
import { StandardRef } from './standards.types'

/**
 * A curriculum unit within a course
 * Stored at: /units/{unit-id}/meta.json within course folder
 */
export interface Unit extends Entity {
  courseId: string
  name: string // "Plate Tectonics"
  description?: string
  order: number // Display order (1-based)
  standardRefs: StandardRef[] // e.g., ["MS-ESS2-1", "MS-ESS2-2"]
  estimatedDays?: number // Rough planning aid

  // Drive folder ID for this unit
  driveFolderId?: string
}

/**
 * Lightweight summary for listing units
 */
export interface UnitSummary {
  id: string
  name: string
  order: number
  assessmentCount: number
  standardCount: number
  driveFolderId?: string
}

/**
 * Input for creating a new unit
 */
export interface CreateUnitInput {
  courseId: string
  name: string
  description?: string
  order?: number // If not provided, will be set to last position
  standardRefs?: StandardRef[]
  estimatedDays?: number
}

/**
 * Input for updating a unit
 */
export interface UpdateUnitInput {
  id: string
  courseId: string
  name?: string
  description?: string
  order?: number
  standardRefs?: StandardRef[]
  estimatedDays?: number
}

/**
 * Input for reordering units
 */
export interface ReorderUnitsInput {
  courseId: string
  unitIds: string[] // Unit IDs in desired order
}

/**
 * Unit with expanded standard references (for UI display)
 */
export interface UnitWithStandards extends Unit {
  standards: Array<{
    code: string
    description: string
    domainCode: string
    domainName: string
  }>
}
