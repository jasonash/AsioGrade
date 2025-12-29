/**
 * Course Material Types
 *
 * Types for uploading and managing legacy course materials
 * with AI text extraction for context in assessment generation.
 */

import type { Entity } from './common.types'

/**
 * Supported file types for course materials
 */
export type CourseMaterialType = 'pdf' | 'doc' | 'docx' | 'ppt' | 'pptx' | 'txt'

/**
 * Status of text extraction from a material
 */
export type ExtractionStatus = 'pending' | 'processing' | 'complete' | 'failed'

/**
 * Full course material with extracted text
 */
export interface CourseMaterial extends Entity {
  courseId: string
  name: string // Display name
  type: CourseMaterialType
  originalFileName: string
  fileSize: number // bytes
  mimeType: string
  extractedText: string // Full text content
  extractionStatus: ExtractionStatus
  extractionError?: string
  driveFileId: string // Original file in Drive
}

/**
 * Summary for listing materials (without full extracted text)
 */
export interface CourseMaterialSummary {
  id: string
  name: string
  type: CourseMaterialType
  originalFileName: string
  fileSize: number
  extractionStatus: ExtractionStatus
  extractionError?: string
  createdAt: string
  updatedAt: string
}

/**
 * Input for uploading a new material
 */
export interface UploadMaterialInput {
  courseId: string
  name: string
  filePath: string // Local path to upload
}

/**
 * Input for creating material metadata (after upload)
 */
export interface CreateMaterialInput {
  courseId: string
  name: string
  type: CourseMaterialType
  originalFileName: string
  fileSize: number
  mimeType: string
  extractedText: string
  extractionStatus: ExtractionStatus
  extractionError?: string
  driveFileId: string
}

/**
 * Input for updating a material
 */
export interface UpdateMaterialInput {
  id: string
  courseId: string
  name?: string
}

/**
 * Helper to get MIME type from file extension
 */
export function getMimeType(type: CourseMaterialType): string {
  switch (type) {
    case 'pdf':
      return 'application/pdf'
    case 'doc':
      return 'application/msword'
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    case 'ppt':
      return 'application/vnd.ms-powerpoint'
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    case 'txt':
      return 'text/plain'
    default:
      return 'application/octet-stream'
  }
}

/**
 * Helper to get file extension from MIME type
 */
export function getTypeFromMime(mimeType: string): CourseMaterialType | null {
  switch (mimeType) {
    case 'application/pdf':
      return 'pdf'
    case 'application/msword':
      return 'doc'
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'docx'
    case 'application/vnd.ms-powerpoint':
      return 'ppt'
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return 'pptx'
    case 'text/plain':
      return 'txt'
    default:
      return null
  }
}

/**
 * Helper to get file extension from file path
 */
export function getTypeFromExtension(filePath: string): CourseMaterialType | null {
  const ext = filePath.toLowerCase().split('.').pop()
  switch (ext) {
    case 'pdf':
      return 'pdf'
    case 'doc':
      return 'doc'
    case 'docx':
      return 'docx'
    case 'ppt':
      return 'ppt'
    case 'pptx':
      return 'pptx'
    case 'txt':
      return 'txt'
    default:
      return null
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
