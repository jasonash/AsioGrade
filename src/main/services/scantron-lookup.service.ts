/**
 * Scantron Lookup Service
 *
 * SQLite-based service for storing and retrieving scantron metadata using short keys.
 * This dramatically improves QR code scan reliability by encoding only a short key
 * instead of full JSON data.
 *
 * QR Format v3: "TH:XXXXXXXX" where X is an 8-character alphanumeric key
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import type { DOKLevel } from '../../shared/types/roster.types'
import type { VersionId } from '../../shared/types/assignment.types'
import type { ScantronFormat } from '../../shared/types/scantron.types'

/**
 * Full scantron metadata stored in the database
 */
export interface ScantronLookupRecord {
  key: string
  assignmentId: string
  studentId: string
  format?: ScantronFormat
  dokLevel?: DOKLevel
  versionId?: VersionId
  createdAt: string
  // Extended fields that don't affect QR size
  assessmentTitle?: string
  studentName?: string
  courseName?: string
}

/**
 * Input for creating a new scantron lookup record
 */
export interface CreateScantronLookupInput {
  assignmentId: string
  studentId: string
  format?: ScantronFormat
  dokLevel?: DOKLevel
  versionId?: VersionId
  assessmentTitle?: string
  studentName?: string
  courseName?: string
}

// Characters that scan well (avoiding 0/O, 1/l/I confusion)
const KEY_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const KEY_LENGTH = 8
const KEY_PREFIX = 'TH:' // TeachingHelp prefix for our QR codes

class ScantronLookupService {
  private db: Database.Database | null = null
  private dbPath: string

  constructor() {
    // Store database in user data directory
    const userDataPath = app.getPath('userData')
    const dbDir = join(userDataPath, 'data')

    // Ensure directory exists
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true })
    }

    this.dbPath = join(dbDir, 'scantron-lookup.db')
  }

  /**
   * Initialize the database (call on app startup)
   */
  initialize(): void {
    if (this.db) return

    console.log('[ScantronLookup] Initializing database at:', this.dbPath)

    this.db = new Database(this.dbPath)

    // Enable WAL mode for better concurrent performance
    this.db.pragma('journal_mode = WAL')

    // Create tables if they don't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scantron_keys (
        key TEXT PRIMARY KEY,
        assignment_id TEXT NOT NULL,
        student_id TEXT NOT NULL,
        format TEXT,
        dok_level INTEGER,
        version_id TEXT,
        created_at TEXT NOT NULL,
        assessment_title TEXT,
        student_name TEXT,
        course_name TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_assignment ON scantron_keys(assignment_id);
      CREATE INDEX IF NOT EXISTS idx_student ON scantron_keys(student_id);
      CREATE INDEX IF NOT EXISTS idx_created_at ON scantron_keys(created_at);
    `)

    console.log('[ScantronLookup] Database initialized successfully')
  }

  /**
   * Generate a unique short key
   */
  private generateKey(): string {
    let key = ''
    for (let i = 0; i < KEY_LENGTH; i++) {
      key += KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)]
    }
    return key
  }

  /**
   * Generate a unique key that doesn't exist in the database
   */
  private generateUniqueKey(): string {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const checkStmt = this.db.prepare('SELECT 1 FROM scantron_keys WHERE key = ?')

    // Try up to 10 times to generate a unique key
    for (let attempt = 0; attempt < 10; attempt++) {
      const key = this.generateKey()
      const exists = checkStmt.get(key)
      if (!exists) {
        return key
      }
    }

    // If we still can't find a unique key (extremely unlikely), throw an error
    throw new Error('Failed to generate unique scantron key after 10 attempts')
  }

  /**
   * Create a new scantron lookup record
   * Returns the short key to encode in the QR code
   */
  createLookup(input: CreateScantronLookupInput): string {
    if (!this.db) {
      this.initialize()
    }

    const key = this.generateUniqueKey()
    const createdAt = new Date().toISOString()

    const stmt = this.db!.prepare(`
      INSERT INTO scantron_keys (
        key, assignment_id, student_id, format, dok_level, version_id,
        created_at, assessment_title, student_name, course_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      key,
      input.assignmentId,
      input.studentId,
      input.format ?? null,
      input.dokLevel ?? null,
      input.versionId ?? null,
      createdAt,
      input.assessmentTitle ?? null,
      input.studentName ?? null,
      input.courseName ?? null
    )

    console.log(`[ScantronLookup] Created key ${key} for student ${input.studentId}`)
    return key
  }

  /**
   * Batch create multiple lookup records (more efficient for generating many scantrons)
   * Returns array of keys in the same order as inputs
   */
  createLookupBatch(inputs: CreateScantronLookupInput[]): string[] {
    if (!this.db) {
      this.initialize()
    }

    const keys: string[] = []
    const createdAt = new Date().toISOString()

    const stmt = this.db!.prepare(`
      INSERT INTO scantron_keys (
        key, assignment_id, student_id, format, dok_level, version_id,
        created_at, assessment_title, student_name, course_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    // Use a transaction for batch inserts
    const insertMany = this.db!.transaction((inputs: CreateScantronLookupInput[]) => {
      for (const input of inputs) {
        const key = this.generateUniqueKey()
        keys.push(key)

        stmt.run(
          key,
          input.assignmentId,
          input.studentId,
          input.format ?? null,
          input.dokLevel ?? null,
          input.versionId ?? null,
          createdAt,
          input.assessmentTitle ?? null,
          input.studentName ?? null,
          input.courseName ?? null
        )
      }
    })

    insertMany(inputs)
    console.log(`[ScantronLookup] Created ${keys.length} keys in batch`)
    return keys
  }

  /**
   * Look up scantron data by key
   */
  getLookup(key: string): ScantronLookupRecord | null {
    if (!this.db) {
      this.initialize()
    }

    const stmt = this.db!.prepare(`
      SELECT
        key,
        assignment_id as assignmentId,
        student_id as studentId,
        format,
        dok_level as dokLevel,
        version_id as versionId,
        created_at as createdAt,
        assessment_title as assessmentTitle,
        student_name as studentName,
        course_name as courseName
      FROM scantron_keys
      WHERE key = ?
    `)

    const row = stmt.get(key) as ScantronLookupRecord | undefined
    return row ?? null
  }

  /**
   * Delete lookup records for an assignment (cleanup when assignment is deleted)
   */
  deleteByAssignment(assignmentId: string): number {
    if (!this.db) {
      this.initialize()
    }

    const stmt = this.db!.prepare('DELETE FROM scantron_keys WHERE assignment_id = ?')
    const result = stmt.run(assignmentId)
    console.log(`[ScantronLookup] Deleted ${result.changes} keys for assignment ${assignmentId}`)
    return result.changes
  }

  /**
   * Get all lookup records for an assignment
   */
  getByAssignment(assignmentId: string): ScantronLookupRecord[] {
    if (!this.db) {
      this.initialize()
    }

    const stmt = this.db!.prepare(`
      SELECT
        key,
        assignment_id as assignmentId,
        student_id as studentId,
        format,
        dok_level as dokLevel,
        version_id as versionId,
        created_at as createdAt,
        assessment_title as assessmentTitle,
        student_name as studentName,
        course_name as courseName
      FROM scantron_keys
      WHERE assignment_id = ?
    `)

    return stmt.all(assignmentId) as ScantronLookupRecord[]
  }

  /**
   * Clean up old records (optional maintenance)
   * Deletes records older than the specified number of days
   */
  cleanupOldRecords(olderThanDays: number = 365): number {
    if (!this.db) {
      this.initialize()
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)
    const cutoffIso = cutoffDate.toISOString()

    const stmt = this.db!.prepare('DELETE FROM scantron_keys WHERE created_at < ?')
    const result = stmt.run(cutoffIso)
    console.log(`[ScantronLookup] Cleaned up ${result.changes} records older than ${olderThanDays} days`)
    return result.changes
  }

  /**
   * Get database statistics
   */
  getStats(): { totalRecords: number; oldestRecord: string | null; newestRecord: string | null } {
    if (!this.db) {
      this.initialize()
    }

    const countStmt = this.db!.prepare('SELECT COUNT(*) as count FROM scantron_keys')
    const oldestStmt = this.db!.prepare('SELECT MIN(created_at) as oldest FROM scantron_keys')
    const newestStmt = this.db!.prepare('SELECT MAX(created_at) as newest FROM scantron_keys')

    const count = (countStmt.get() as { count: number }).count
    const oldest = (oldestStmt.get() as { oldest: string | null }).oldest
    const newest = (newestStmt.get() as { newest: string | null }).newest

    return {
      totalRecords: count,
      oldestRecord: oldest,
      newestRecord: newest
    }
  }

  /**
   * Format a key for QR code encoding
   * Returns "TH:XXXXXXXX" format
   */
  formatKeyForQR(key: string): string {
    return `${KEY_PREFIX}${key}`
  }

  /**
   * Parse a QR code string to extract the key
   * Returns the key if valid v3 format, null otherwise
   */
  parseQRString(qrString: string): string | null {
    const trimmed = qrString.trim()

    // Check for v3 format: "TH:XXXXXXXX"
    if (trimmed.startsWith(KEY_PREFIX) && trimmed.length === KEY_PREFIX.length + KEY_LENGTH) {
      return trimmed.substring(KEY_PREFIX.length)
    }

    return null
  }

  /**
   * Check if a QR string is v3 format
   */
  isV3Format(qrString: string): boolean {
    return this.parseQRString(qrString) !== null
  }

  /**
   * Get the database file path (for backup purposes)
   */
  getDatabasePath(): string {
    return this.dbPath
  }

  /**
   * Close the database connection (call on app quit)
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      console.log('[ScantronLookup] Database closed')
    }
  }
}

// Singleton instance
export const scantronLookupService = new ScantronLookupService()
