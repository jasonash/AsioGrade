/**
 * Standards type definitions
 * Teaching standards (e.g., NGSS, state standards) that can be imported
 * and aligned to units and assessments
 */

import { Versioned } from './common.types'

/**
 * Source information for where standards were imported from
 */
export interface StandardsSource {
  type: 'url' | 'pdf' | 'manual'
  url?: string
  filename?: string
  fetchedAt: string // ISO datetime
}

/**
 * An individual teaching standard
 * e.g., "MS-ESS2-1: Develop a model to describe the cycling of Earth's materials"
 */
export interface Standard {
  code: string // "MS-ESS2-1"
  description: string
  keywords: string[] // For search and topic matching
  cluster?: string // Optional grouping within domain
  notes?: string // Teacher notes
}

/**
 * A cluster groups related standards within a domain
 * e.g., "Earth's Materials and Systems"
 */
export interface StandardCluster {
  code: string
  name: string
}

/**
 * A domain is a broad category containing multiple standards
 * e.g., "MS-ESS2: Earth's Systems"
 */
export interface StandardDomain {
  code: string // "MS-ESS2"
  name: string // "Earth's Systems"
  description?: string
  clusters?: StandardCluster[]
  standards: Standard[]
}

/**
 * Complete standards collection for a course
 * Stored at: /standards/{id}.json within course folder
 * A course can have multiple standards collections (e.g., NGSS + state standards)
 */
export interface Standards extends Versioned {
  id: string // Unique identifier for this collection
  courseId: string
  updatedAt: string // ISO datetime

  source: StandardsSource

  // Metadata about the standards
  name: string // Display name for this collection (e.g., "NGSS Earth Science")
  state: string // "Kansas"
  subject: string // "Science"
  gradeLevel: string // "6-8"
  framework: string // "NGSS", "Common Core", etc.

  // The actual standards organized by domain
  domains: StandardDomain[]
}

/**
 * Lightweight summary for listing standards collections
 */
export interface StandardsSummary {
  id: string
  courseId: string
  name: string
  state: string
  subject: string
  gradeLevel: string
  framework: string
  standardCount: number
  domainCount: number
  updatedAt: string
}

/**
 * Input for creating/importing a standards collection
 */
export interface CreateStandardsInput {
  courseId: string
  name: string // Display name for this collection
  source: StandardsSource
  state: string
  subject: string
  gradeLevel: string
  framework: string
  domains: StandardDomain[]
}

/**
 * Input for updating an existing standards collection
 */
export interface UpdateStandardsInput {
  id: string
  courseId: string
  name?: string
  source?: StandardsSource
  state?: string
  subject?: string
  gradeLevel?: string
  framework?: string
  domains?: StandardDomain[]
}

/**
 * Input for adding a single standard to existing standards collection
 */
export interface AddStandardInput {
  standardsId: string // Which standards collection
  courseId: string
  domainCode: string // Which domain to add to
  standard: Omit<Standard, 'code'> & { code?: string } // Code can be auto-generated
}

/**
 * Input for updating a standard within a collection
 */
export interface UpdateStandardInput {
  standardsId: string // Which standards collection
  courseId: string
  domainCode: string
  standardCode: string
  description?: string
  keywords?: string[]
  notes?: string
}

/**
 * Reference to a standard (used in units and assessments)
 * Can be just the code for simple references, or include additional context
 */
export type StandardRef = string // e.g., "MS-ESS2-1"

/**
 * Expanded standard reference with additional context
 * Used when displaying standard details in UI
 */
export interface StandardRefExpanded {
  code: string
  description: string
  domainCode: string
  domainName: string
}
