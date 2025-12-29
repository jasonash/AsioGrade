/**
 * Scantron type definitions
 *
 * Types for generating and parsing scantron answer sheets.
 */

import type { DOKLevel } from './roster.types'
import type { VersionId } from './assignment.types'

/**
 * Scantron format type
 * - 'quiz': Single-page with questions on left, bubbles on right (3-10 questions)
 * - undefined: Standard multi-column bubble sheet
 */
export type ScantronFormat = 'quiz'

/**
 * QR code data encoded on each scantron page
 *
 * v1: Basic identification (aid, sid, fmt)
 * v2: Added DOK level and version for grading lookup
 * v3: Short key lookup system (just a key, all data in SQLite)
 */
export interface ScantronQRDataV1V2 {
  v: 1 | 2 // Schema version (1 = legacy, 2 = with DOK/version)
  aid: string // Assignment ID
  sid: string // Student ID
  fmt?: ScantronFormat // Optional: scantron format (if missing, assume standard)
  // v2 fields (optional for backwards compatibility)
  dok?: DOKLevel // Student's DOK level for this assessment
  ver?: VersionId // Version assigned to this student (A/B/C/D)
}

/**
 * v3 QR data is just a short string: "TH:XXXXXXXX"
 * All metadata is stored in SQLite and looked up by key
 */
export interface ScantronQRDataV3 {
  v: 3
  k: string // Short 8-character key
}

/**
 * Union type for all QR data versions
 */
export type ScantronQRData = ScantronQRDataV1V2 | ScantronQRDataV3

/**
 * Resolved scantron data (after looking up v3 keys from database)
 * This is what the grading service uses after resolving QR data
 */
export interface ResolvedScantronData {
  assignmentId: string
  studentId: string
  format?: ScantronFormat
  dokLevel?: DOKLevel
  versionId?: VersionId
}

/**
 * Options for scantron PDF generation
 */
export interface ScantronOptions {
  paperSize: 'letter' | 'a4'
  includeNameField: boolean
  includeInstructions: boolean
  bubbleStyle: 'circle' | 'oval'
}

/**
 * Request to generate scantron PDFs
 */
export interface ScantronGenerationRequest {
  assignmentId: string
  sectionId: string
  options: ScantronOptions
}

/**
 * Result of scantron PDF generation
 */
export interface ScantronGenerationResult {
  success: boolean
  pdfBuffer?: Buffer
  studentCount: number
  pageCount: number
  generatedAt: string
  error?: string
}

/**
 * Student info for scantron header
 */
export interface ScantronStudentInfo {
  studentId: string
  firstName: string
  lastName: string
  studentNumber?: string
  dokLevel: DOKLevel // Effective DOK level (roster or override)
  versionId: VersionId // Assigned version (A/B/C/D)
}
