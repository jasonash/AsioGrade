/**
 * Scantron type definitions
 *
 * Types for generating and parsing scantron answer sheets.
 */

/**
 * Scantron format type
 * - 'quiz': Single-page with questions on left, bubbles on right (3-10 questions)
 * - undefined: Standard multi-column bubble sheet
 */
export type ScantronFormat = 'quiz'

/**
 * QR code data encoded on each scantron page
 *
 * SIMPLIFIED: Only essential data for identification.
 * All other info (section, unit, version, date, question count) is looked up
 * from the assignment record. This reduces QR code density by ~60% for
 * better scan reliability.
 */
export interface ScantronQRData {
  v: 1 // Schema version (for forwards compatibility)
  aid: string // Assignment ID
  sid: string // Student ID
  fmt?: ScantronFormat // Optional: scantron format (if missing, assume standard)
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
}
