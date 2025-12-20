/**
 * Scantron type definitions
 *
 * Types for generating and parsing scantron answer sheets.
 */

import type { VersionId } from './assignment.types'

/**
 * QR code data encoded on each scantron page
 */
export interface ScantronQRData {
  v: 1 // Schema version
  sid: string // Student ID
  secid: string // Section ID
  aid: string // Assignment ID
  uid: string // Unit ID (needed to look up assessment)
  ver: VersionId // Version (always 'A' for now)
  var?: string // Variant ID (for future UDL support)
  dt: string // Date (ISO format)
  qc: number // Question count
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
  unitId: string // Needed for QR code to enable automatic grading lookup
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
}
