import { google, drive_v3 } from 'googleapis'
import { authService } from './auth.service'
import { storageService } from './storage.service'
import {
  Course,
  CourseSummary,
  CreateCourseInput,
  UpdateCourseInput,
  Section,
  SectionSummary,
  CreateSectionInput,
  UpdateSectionInput,
  Roster,
  Student,
  CreateStudentInput,
  UpdateStudentInput,
  Standards,
  StandardsSummary,
  CreateStandardsInput,
  UpdateStandardsInput,
  Unit,
  UnitSummary,
  CreateUnitInput,
  UpdateUnitInput,
  ReorderUnitsInput,
  ServiceResult
} from '../../shared/types'

// App config stored in Google Drive
interface AppConfig {
  version: number
  createdAt: string
  owner: {
    id: string
    email: string
    name: string
  }
}

// Cache for folder IDs to avoid repeated lookups
interface FolderCache {
  appFolderId?: string
  yearFolderIds: Record<string, string> // year -> folderId
  courseFolderIds: Record<string, string> // courseId -> folderId
  sectionFolderIds: Record<string, string> // sectionId -> folderId
  unitFolderIds: Record<string, string> // unitId -> folderId
}

// Metadata cache with TTL for performance
interface CacheEntry<T> {
  data: T
  timestamp: number
}

interface MetadataCache {
  courses: Record<string, CacheEntry<Course>>
  sections: Record<string, CacheEntry<Section>>
  units: Record<string, CacheEntry<Unit>>
  standardsCollections: Record<string, CacheEntry<Standards>> // standardsId -> standards collection
  standardsSummaries: Record<string, CacheEntry<StandardsSummary[]>> // courseFolderId -> list of summaries
  sectionCounts: Record<string, CacheEntry<number>> // courseFolderId -> section count
  studentCounts: Record<string, CacheEntry<number>> // sectionFolderId -> student count
  unitCounts: Record<string, CacheEntry<number>> // courseFolderId -> unit count
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

class DriveService {
  private drive: drive_v3.Drive | null = null
  private folderCache: FolderCache = {
    yearFolderIds: {},
    courseFolderIds: {},
    sectionFolderIds: {},
    unitFolderIds: {}
  }
  private metadataCache: MetadataCache = {
    courses: {},
    sections: {},
    units: {},
    standardsCollections: {},
    standardsSummaries: {},
    sectionCounts: {},
    studentCounts: {},
    unitCounts: {}
  }

  /**
   * Get authenticated Drive client
   */
  private async getDrive(): Promise<drive_v3.Drive> {
    if (this.drive) {
      return this.drive
    }

    const oauth2Client = authService.getOAuth2Client()
    this.drive = google.drive({ version: 'v3', auth: oauth2Client })
    return this.drive
  }

  /**
   * Reset the Drive client (call after logout)
   */
  resetClient(): void {
    this.drive = null
    this.folderCache = {
      yearFolderIds: {},
      courseFolderIds: {},
      sectionFolderIds: {},
      unitFolderIds: {}
    }
    this.metadataCache = {
      courses: {},
      sections: {},
      units: {},
      standardsCollections: {},
      standardsSummaries: {},
      sectionCounts: {},
      studentCounts: {},
      unitCounts: {}
    }
  }

  /**
   * Check if a cache entry is still valid
   */
  private isCacheValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
    if (!entry) return false
    return Date.now() - entry.timestamp < CACHE_TTL_MS
  }

  /**
   * Invalidate caches related to a course (call after mutations)
   */
  private invalidateCourseCache(courseId: string, courseFolderId?: string): void {
    delete this.metadataCache.courses[courseId]
    if (courseFolderId) {
      delete this.metadataCache.sectionCounts[courseFolderId]
    }
  }

  /**
   * Invalidate caches related to a section (call after mutations)
   */
  private invalidateSectionCache(sectionId: string, sectionFolderId?: string): void {
    delete this.metadataCache.sections[sectionId]
    if (sectionFolderId) {
      delete this.metadataCache.studentCounts[sectionFolderId]
    }
  }

  /**
   * Invalidate caches related to a unit (call after mutations)
   */
  private invalidateUnitCache(unitId: string, courseFolderId?: string): void {
    delete this.metadataCache.units[unitId]
    if (courseFolderId) {
      delete this.metadataCache.unitCounts[courseFolderId]
    }
  }

  /**
   * Invalidate standards cache for a course (call after mutations)
   */
  private invalidateStandardsCache(courseFolderId: string, standardsId?: string): void {
    // Always invalidate the summaries list for the course
    delete this.metadataCache.standardsSummaries[courseFolderId]
    // If a specific collection was modified, invalidate it too
    if (standardsId) {
      delete this.metadataCache.standardsCollections[standardsId]
    }
  }

  // ============================================================
  // Folder Structure Management
  // ============================================================

  /**
   * Ensure the root TeachingHelp folder exists
   * Creates: /TeachingHelp/
   */
  async ensureAppFolder(): Promise<ServiceResult<string>> {
    try {
      // Check cache first
      if (this.folderCache.appFolderId) {
        return { success: true, data: this.folderCache.appFolderId }
      }

      const drive = await this.getDrive()

      // Search for existing folder
      const response = await drive.files.list({
        q: "name='TeachingHelp' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
        fields: 'files(id, name)',
        spaces: 'drive'
      })

      if (response.data.files && response.data.files.length > 0) {
        const folderId = response.data.files[0].id!
        this.folderCache.appFolderId = folderId
        return { success: true, data: folderId }
      }

      // Create the folder
      const createResponse = await drive.files.create({
        requestBody: {
          name: 'TeachingHelp',
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      })

      const folderId = createResponse.data.id!
      this.folderCache.appFolderId = folderId

      // Create config.json
      await this.createAppConfig(folderId)

      return { success: true, data: folderId }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to ensure app folder'
      return { success: false, error: message }
    }
  }

  /**
   * Create the app config file in the root folder
   */
  private async createAppConfig(appFolderId: string): Promise<void> {
    const drive = await this.getDrive()
    const user = storageService.getUser()

    const config: AppConfig = {
      version: 1,
      createdAt: new Date().toISOString(),
      owner: {
        id: user?.id ?? '',
        email: user?.email ?? '',
        name: user?.name ?? ''
      }
    }

    await drive.files.create({
      requestBody: {
        name: 'config.json',
        mimeType: 'application/json',
        parents: [appFolderId]
      },
      media: {
        mimeType: 'application/json',
        body: JSON.stringify(config, null, 2)
      }
    })
  }

  /**
   * Ensure the year folder structure exists
   * Creates: /TeachingHelp/years/{year}/courses/
   */
  async ensureYearFolder(year: string): Promise<ServiceResult<string>> {
    try {
      // Check cache first
      if (this.folderCache.yearFolderIds[year]) {
        return { success: true, data: this.folderCache.yearFolderIds[year] }
      }

      // Ensure app folder exists first
      const appFolderResult = await this.ensureAppFolder()
      if (!appFolderResult.success) {
        return appFolderResult
      }
      const appFolderId = appFolderResult.data

      // Ensure "years" folder exists
      const yearsFolderId = await this.ensureSubfolder(appFolderId, 'years')

      // Ensure year folder exists (e.g., "2024-2025")
      const yearFolderId = await this.ensureSubfolder(yearsFolderId, year)

      // Ensure "courses" folder exists within year
      const coursesFolderId = await this.ensureSubfolder(yearFolderId, 'courses')

      this.folderCache.yearFolderIds[year] = coursesFolderId
      return { success: true, data: coursesFolderId }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to ensure year folder'
      return { success: false, error: message }
    }
  }

  /**
   * Helper to ensure a subfolder exists within a parent
   */
  private async ensureSubfolder(parentId: string, name: string): Promise<string> {
    const drive = await this.getDrive()

    // Search for existing folder
    const response = await drive.files.list({
      q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    })

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id!
    }

    // Create the folder
    const createResponse = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      },
      fields: 'id'
    })

    return createResponse.data.id!
  }

  // ============================================================
  // Course Operations
  // ============================================================

  /**
   * List all courses for a given academic year
   * Optimized: Uses Promise.all() for parallel fetching and caching
   */
  async listCourses(year: string): Promise<ServiceResult<CourseSummary[]>> {
    try {
      const yearFolderResult = await this.ensureYearFolder(year)
      if (!yearFolderResult.success) {
        return yearFolderResult as ServiceResult<CourseSummary[]>
      }
      const coursesFolderId = yearFolderResult.data

      const drive = await this.getDrive()

      // List all course folders
      const response = await drive.files.list({
        q: `'${coursesFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name, modifiedTime)',
        spaces: 'drive',
        orderBy: 'name'
      })

      const folders = response.data.files ?? []

      // Fetch all course metadata and section counts in parallel
      const courseDataPromises = folders.map(async (folder) => {
        const folderId = folder.id!

        // Fetch metadata and section count in parallel for each course
        const [course, sectionCount] = await Promise.all([
          this.readCourseMetadata(folderId),
          this.countSections(folderId)
        ])

        if (!course) return null

        // Populate folder cache
        this.folderCache.courseFolderIds[course.id] = folderId

        return {
          id: course.id,
          name: course.name,
          subject: course.subject,
          gradeLevel: course.gradeLevel,
          academicYear: course.academicYear,
          sectionCount,
          lastModified: new Date(folder.modifiedTime ?? Date.now()).getTime(),
          driveFolderId: folderId
        } as CourseSummary
      })

      const courseResults = await Promise.all(courseDataPromises)
      const courses = courseResults.filter((c): c is CourseSummary => c !== null)

      return { success: true, data: courses }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list courses'
      return { success: false, error: message }
    }
  }

  /**
   * Read course metadata from a course folder (with caching)
   */
  private async readCourseMetadata(courseFolderId: string): Promise<Course | null> {
    try {
      // Check cache first
      const cached = this.metadataCache.courses[courseFolderId]
      if (this.isCacheValid(cached)) {
        return cached.data
      }

      const drive = await this.getDrive()

      // Find meta.json
      const response = await drive.files.list({
        q: `name='meta.json' and '${courseFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (!response.data.files || response.data.files.length === 0) {
        return null
      }

      const fileId = response.data.files[0].id!

      // Read the file content
      const fileResponse = await drive.files.get({
        fileId,
        alt: 'media'
      })

      const course = fileResponse.data as unknown as Course

      // Cache the result
      if (course) {
        this.metadataCache.courses[courseFolderId] = {
          data: course,
          timestamp: Date.now()
        }
      }

      return course
    } catch {
      return null
    }
  }

  /**
   * Count sections in a course folder (with caching)
   */
  private async countSections(courseFolderId: string): Promise<number> {
    try {
      // Check cache first
      const cached = this.metadataCache.sectionCounts[courseFolderId]
      if (this.isCacheValid(cached)) {
        return cached.data
      }

      const drive = await this.getDrive()

      // Find sections folder
      const sectionsResponse = await drive.files.list({
        q: `name='sections' and mimeType='application/vnd.google-apps.folder' and '${courseFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (!sectionsResponse.data.files || sectionsResponse.data.files.length === 0) {
        // Cache zero count
        this.metadataCache.sectionCounts[courseFolderId] = {
          data: 0,
          timestamp: Date.now()
        }
        return 0
      }

      const sectionsFolderId = sectionsResponse.data.files[0].id!

      // Count section folders
      const response = await drive.files.list({
        q: `'${sectionsFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      const count = response.data.files?.length ?? 0

      // Cache the result
      this.metadataCache.sectionCounts[courseFolderId] = {
        data: count,
        timestamp: Date.now()
      }

      return count
    } catch {
      return 0
    }
  }

  /**
   * Get a specific course by ID
   */
  async getCourse(courseId: string): Promise<ServiceResult<Course>> {
    try {
      // Find the course folder by searching for meta.json with the courseId
      // First, we need to find the folder - courseId should be the folder ID
      const courseFolderId = this.folderCache.courseFolderIds[courseId] ?? courseId

      const course = await this.readCourseMetadata(courseFolderId)
      if (!course) {
        return { success: false, error: 'Course not found' }
      }

      return { success: true, data: course }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get course'
      return { success: false, error: message }
    }
  }

  /**
   * Create a new course with folder structure
   */
  async createCourse(input: CreateCourseInput): Promise<ServiceResult<Course>> {
    try {
      const yearFolderResult = await this.ensureYearFolder(input.academicYear)
      if (!yearFolderResult.success) {
        return yearFolderResult as ServiceResult<Course>
      }
      const coursesFolderId = yearFolderResult.data

      const drive = await this.getDrive()
      const user = storageService.getUser()

      // Generate unique course ID (slug + random suffix)
      const courseId = this.generateUniqueId(input.name)
      const now = new Date().toISOString()

      // Create course folder
      const folderResponse = await drive.files.create({
        requestBody: {
          name: courseId,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [coursesFolderId]
        },
        fields: 'id'
      })

      const courseFolderId = folderResponse.data.id!
      this.folderCache.courseFolderIds[courseId] = courseFolderId

      // Create subfolders
      await Promise.all([
        this.ensureSubfolder(courseFolderId, 'standards'),
        this.ensureSubfolder(courseFolderId, 'units'),
        this.ensureSubfolder(courseFolderId, 'materials'),
        this.ensureSubfolder(courseFolderId, 'sections')
      ])

      // Create course metadata
      const course: Course = {
        id: courseId,
        name: input.name,
        subject: input.subject,
        gradeLevel: input.gradeLevel,
        description: input.description,
        academicYear: input.academicYear,
        ownerId: user?.id ?? '',
        driveFolderId: courseFolderId,
        createdAt: now,
        updatedAt: now,
        version: 1
      }

      // Save meta.json
      await drive.files.create({
        requestBody: {
          name: 'meta.json',
          mimeType: 'application/json',
          parents: [courseFolderId]
        },
        media: {
          mimeType: 'application/json',
          body: JSON.stringify(course, null, 2)
        }
      })

      return { success: true, data: course }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create course'
      return { success: false, error: message }
    }
  }

  /**
   * Update course metadata
   */
  async updateCourse(input: UpdateCourseInput): Promise<ServiceResult<Course>> {
    try {
      // Get existing course
      const existingResult = await this.getCourse(input.id)
      if (!existingResult.success) {
        return existingResult
      }
      const existing = existingResult.data

      const drive = await this.getDrive()
      const courseFolderId = existing.driveFolderId ?? this.folderCache.courseFolderIds[input.id]

      if (!courseFolderId) {
        return { success: false, error: 'Course folder not found' }
      }

      // Find meta.json file ID
      const metaResponse = await drive.files.list({
        q: `name='meta.json' and '${courseFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (!metaResponse.data.files || metaResponse.data.files.length === 0) {
        return { success: false, error: 'Course metadata not found' }
      }

      const metaFileId = metaResponse.data.files[0].id!

      // Update course
      const updated: Course = {
        ...existing,
        name: input.name ?? existing.name,
        subject: input.subject ?? existing.subject,
        gradeLevel: input.gradeLevel ?? existing.gradeLevel,
        description: input.description ?? existing.description,
        updatedAt: new Date().toISOString(),
        version: existing.version + 1
      }

      // Update the file
      await drive.files.update({
        fileId: metaFileId,
        media: {
          mimeType: 'application/json',
          body: JSON.stringify(updated, null, 2)
        }
      })

      // Invalidate cache
      this.invalidateCourseCache(input.id, courseFolderId)

      return { success: true, data: updated }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update course'
      return { success: false, error: message }
    }
  }

  /**
   * Delete a course and all its contents
   */
  async deleteCourse(courseId: string): Promise<ServiceResult<void>> {
    try {
      const drive = await this.getDrive()

      // Get course folder ID
      const existingResult = await this.getCourse(courseId)
      if (!existingResult.success) {
        return { success: false, error: existingResult.error }
      }

      const courseFolderId =
        existingResult.data.driveFolderId ?? this.folderCache.courseFolderIds[courseId]

      if (!courseFolderId) {
        return { success: false, error: 'Course folder not found' }
      }

      // Move to trash (safer than permanent delete)
      await drive.files.update({
        fileId: courseFolderId,
        requestBody: {
          trashed: true
        }
      })

      // Clear from caches
      delete this.folderCache.courseFolderIds[courseId]
      this.invalidateCourseCache(courseId, courseFolderId)

      return { success: true, data: undefined }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete course'
      return { success: false, error: message }
    }
  }

  // ============================================================
  // Section Operations
  // ============================================================

  /**
   * List all sections for a course
   * Optimized: Uses Promise.all() for parallel fetching and caching
   */
  async listSections(courseId: string): Promise<ServiceResult<SectionSummary[]>> {
    try {
      // Get course to find folder ID
      const courseResult = await this.getCourse(courseId)
      if (!courseResult.success) {
        return { success: false, error: courseResult.error }
      }

      const courseFolderId = courseResult.data.driveFolderId
      if (!courseFolderId) {
        return { success: false, error: 'Course folder not found' }
      }

      const drive = await this.getDrive()

      // Find sections folder
      const sectionsFolderId = await this.ensureSubfolder(courseFolderId, 'sections')

      // List all section folders
      const response = await drive.files.list({
        q: `'${sectionsFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive',
        orderBy: 'name'
      })

      const folders = response.data.files ?? []

      // Fetch all section metadata and student counts in parallel
      const sectionDataPromises = folders.map(async (folder) => {
        const folderId = folder.id!

        // Fetch metadata and student count in parallel for each section
        const [section, studentCount] = await Promise.all([
          this.readSectionMetadata(folderId),
          this.countStudents(folderId)
        ])

        if (!section) return null

        // Populate folder cache
        this.folderCache.sectionFolderIds[section.id] = folderId

        return {
          id: section.id,
          courseId: section.courseId,
          name: section.name,
          studentCount,
          schedule: section.schedule,
          room: section.room,
          driveFolderId: folderId
        } as SectionSummary
      })

      const sectionResults = await Promise.all(sectionDataPromises)
      const sections = sectionResults.filter((s): s is SectionSummary => s !== null)

      return { success: true, data: sections }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list sections'
      return { success: false, error: message }
    }
  }

  /**
   * Read section metadata from a section folder (with caching)
   */
  private async readSectionMetadata(sectionFolderId: string): Promise<Section | null> {
    try {
      // Check cache first
      const cached = this.metadataCache.sections[sectionFolderId]
      if (this.isCacheValid(cached)) {
        return cached.data
      }

      const drive = await this.getDrive()

      // Find meta.json
      const response = await drive.files.list({
        q: `name='meta.json' and '${sectionFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (!response.data.files || response.data.files.length === 0) {
        return null
      }

      const fileId = response.data.files[0].id!

      // Read the file content
      const fileResponse = await drive.files.get({
        fileId,
        alt: 'media'
      })

      const section = fileResponse.data as unknown as Section

      // Cache the result
      if (section) {
        this.metadataCache.sections[sectionFolderId] = {
          data: section,
          timestamp: Date.now()
        }
      }

      return section
    } catch {
      return null
    }
  }

  /**
   * Count students in a section (with caching)
   */
  private async countStudents(sectionFolderId: string): Promise<number> {
    try {
      // Check cache first
      const cached = this.metadataCache.studentCounts[sectionFolderId]
      if (this.isCacheValid(cached)) {
        return cached.data
      }

      const roster = await this.readRosterFile(sectionFolderId)
      const count = roster?.students.filter((s) => s.active).length ?? 0

      // Cache the result
      this.metadataCache.studentCounts[sectionFolderId] = {
        data: count,
        timestamp: Date.now()
      }

      return count
    } catch {
      return 0
    }
  }

  /**
   * Get a specific section by ID
   */
  async getSection(sectionId: string): Promise<ServiceResult<Section>> {
    try {
      const sectionFolderId = this.folderCache.sectionFolderIds[sectionId] ?? sectionId

      const section = await this.readSectionMetadata(sectionFolderId)
      if (!section) {
        return { success: false, error: 'Section not found' }
      }

      return { success: true, data: section }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get section'
      return { success: false, error: message }
    }
  }

  /**
   * Create a new section within a course
   */
  async createSection(input: CreateSectionInput): Promise<ServiceResult<Section>> {
    try {
      // Get course to find folder ID
      const courseResult = await this.getCourse(input.courseId)
      if (!courseResult.success) {
        return { success: false, error: courseResult.error }
      }

      const courseFolderId = courseResult.data.driveFolderId
      if (!courseFolderId) {
        return { success: false, error: 'Course folder not found' }
      }

      const drive = await this.getDrive()

      // Get sections folder
      const sectionsFolderId = await this.ensureSubfolder(courseFolderId, 'sections')

      // Generate unique section ID (slug + random suffix)
      const sectionId = this.generateUniqueId(input.name)
      const now = new Date().toISOString()

      // Create section folder
      const folderResponse = await drive.files.create({
        requestBody: {
          name: sectionId,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [sectionsFolderId]
        },
        fields: 'id'
      })

      const sectionFolderId = folderResponse.data.id!
      this.folderCache.sectionFolderIds[sectionId] = sectionFolderId

      // Create subfolders
      await Promise.all([
        this.ensureSubfolder(sectionFolderId, 'assignments'),
        this.ensureSubfolder(sectionFolderId, 'grades')
      ])

      // Create section metadata
      const section: Section = {
        id: sectionId,
        courseId: input.courseId,
        name: input.name,
        schedule: input.schedule,
        room: input.room,
        driveFolderId: sectionFolderId,
        createdAt: now,
        updatedAt: now,
        version: 1
      }

      // Save meta.json
      await drive.files.create({
        requestBody: {
          name: 'meta.json',
          mimeType: 'application/json',
          parents: [sectionFolderId]
        },
        media: {
          mimeType: 'application/json',
          body: JSON.stringify(section, null, 2)
        }
      })

      // Create empty roster
      const roster: Roster = {
        sectionId,
        version: 1,
        updatedAt: now,
        students: []
      }

      await drive.files.create({
        requestBody: {
          name: 'roster.json',
          mimeType: 'application/json',
          parents: [sectionFolderId]
        },
        media: {
          mimeType: 'application/json',
          body: JSON.stringify(roster, null, 2)
        }
      })

      // Invalidate section count cache for the course
      delete this.metadataCache.sectionCounts[courseFolderId]

      return { success: true, data: section }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create section'
      return { success: false, error: message }
    }
  }

  /**
   * Update section metadata
   */
  async updateSection(input: UpdateSectionInput): Promise<ServiceResult<Section>> {
    try {
      // Get existing section
      const existingResult = await this.getSection(input.id)
      if (!existingResult.success) {
        return existingResult
      }
      const existing = existingResult.data

      const drive = await this.getDrive()
      const sectionFolderId = existing.driveFolderId ?? this.folderCache.sectionFolderIds[input.id]

      if (!sectionFolderId) {
        return { success: false, error: 'Section folder not found' }
      }

      // Find meta.json file ID
      const metaResponse = await drive.files.list({
        q: `name='meta.json' and '${sectionFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (!metaResponse.data.files || metaResponse.data.files.length === 0) {
        return { success: false, error: 'Section metadata not found' }
      }

      const metaFileId = metaResponse.data.files[0].id!

      // Update section
      const updated: Section = {
        ...existing,
        name: input.name ?? existing.name,
        schedule: input.schedule ?? existing.schedule,
        room: input.room ?? existing.room,
        updatedAt: new Date().toISOString(),
        version: existing.version + 1
      }

      // Update the file
      await drive.files.update({
        fileId: metaFileId,
        media: {
          mimeType: 'application/json',
          body: JSON.stringify(updated, null, 2)
        }
      })

      // Invalidate cache
      this.invalidateSectionCache(input.id, sectionFolderId)

      return { success: true, data: updated }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update section'
      return { success: false, error: message }
    }
  }

  /**
   * Delete a section and all its contents
   */
  async deleteSection(sectionId: string): Promise<ServiceResult<void>> {
    try {
      const drive = await this.getDrive()

      // Get section folder ID
      const existingResult = await this.getSection(sectionId)
      if (!existingResult.success) {
        return { success: false, error: existingResult.error }
      }

      const sectionFolderId =
        existingResult.data.driveFolderId ?? this.folderCache.sectionFolderIds[sectionId]

      if (!sectionFolderId) {
        return { success: false, error: 'Section folder not found' }
      }

      // Move to trash
      await drive.files.update({
        fileId: sectionFolderId,
        requestBody: {
          trashed: true
        }
      })

      // Clear from caches
      delete this.folderCache.sectionFolderIds[sectionId]
      this.invalidateSectionCache(sectionId, sectionFolderId)

      // Also invalidate section count for the course
      const courseId = existingResult.data.courseId
      const courseFolderId = this.folderCache.courseFolderIds[courseId]
      if (courseFolderId) {
        delete this.metadataCache.sectionCounts[courseFolderId]
      }

      return { success: true, data: undefined }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete section'
      return { success: false, error: message }
    }
  }

  // ============================================================
  // Roster Operations
  // ============================================================

  /**
   * Get roster for a section
   */
  async getRoster(sectionId: string): Promise<ServiceResult<Roster>> {
    try {
      // Get section to find folder ID
      const sectionResult = await this.getSection(sectionId)
      if (!sectionResult.success) {
        return { success: false, error: sectionResult.error }
      }

      const sectionFolderId = sectionResult.data.driveFolderId
      if (!sectionFolderId) {
        return { success: false, error: 'Section folder not found' }
      }

      const roster = await this.readRosterFile(sectionFolderId)
      if (!roster) {
        // Return empty roster if not found
        return {
          success: true,
          data: {
            sectionId,
            version: 1,
            updatedAt: new Date().toISOString(),
            students: []
          }
        }
      }

      return { success: true, data: roster }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get roster'
      return { success: false, error: message }
    }
  }

  /**
   * Read roster file from a section folder
   */
  private async readRosterFile(sectionFolderId: string): Promise<Roster | null> {
    try {
      const drive = await this.getDrive()

      // Find roster.json
      const response = await drive.files.list({
        q: `name='roster.json' and '${sectionFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (!response.data.files || response.data.files.length === 0) {
        return null
      }

      const fileId = response.data.files[0].id!

      // Read the file content
      const fileResponse = await drive.files.get({
        fileId,
        alt: 'media'
      })

      return fileResponse.data as unknown as Roster
    } catch {
      return null
    }
  }

  /**
   * Save roster for a section
   */
  async saveRoster(sectionId: string, roster: Roster): Promise<ServiceResult<Roster>> {
    try {
      // Get section to find folder ID
      const sectionResult = await this.getSection(sectionId)
      if (!sectionResult.success) {
        return { success: false, error: sectionResult.error }
      }

      const sectionFolderId = sectionResult.data.driveFolderId
      if (!sectionFolderId) {
        return { success: false, error: 'Section folder not found' }
      }

      const drive = await this.getDrive()

      // Find roster.json file ID
      const rosterResponse = await drive.files.list({
        q: `name='roster.json' and '${sectionFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      const updatedRoster: Roster = {
        ...roster,
        sectionId,
        updatedAt: new Date().toISOString(),
        version: roster.version + 1
      }

      if (rosterResponse.data.files && rosterResponse.data.files.length > 0) {
        // Update existing file
        const fileId = rosterResponse.data.files[0].id!
        await drive.files.update({
          fileId,
          media: {
            mimeType: 'application/json',
            body: JSON.stringify(updatedRoster, null, 2)
          }
        })
      } else {
        // Create new file
        await drive.files.create({
          requestBody: {
            name: 'roster.json',
            mimeType: 'application/json',
            parents: [sectionFolderId]
          },
          media: {
            mimeType: 'application/json',
            body: JSON.stringify(updatedRoster, null, 2)
          }
        })
      }

      // Invalidate student count cache for this section
      delete this.metadataCache.studentCounts[sectionFolderId]

      return { success: true, data: updatedRoster }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save roster'
      return { success: false, error: message }
    }
  }

  /**
   * Add a student to a section's roster
   */
  async addStudent(sectionId: string, input: CreateStudentInput): Promise<ServiceResult<Student>> {
    try {
      // Get current roster
      const rosterResult = await this.getRoster(sectionId)
      if (!rosterResult.success) {
        return { success: false, error: rosterResult.error }
      }

      const roster = rosterResult.data
      const now = new Date().toISOString()

      // Create student
      const student: Student = {
        id: this.generateId(),
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        studentNumber: input.studentNumber,
        notes: input.notes,
        active: true,
        createdAt: now,
        updatedAt: now
      }

      // Add to roster
      roster.students.push(student)

      // Save roster
      const saveResult = await this.saveRoster(sectionId, roster)
      if (!saveResult.success) {
        return { success: false, error: saveResult.error }
      }

      return { success: true, data: student }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add student'
      return { success: false, error: message }
    }
  }

  /**
   * Update a student in a section's roster
   */
  async updateStudent(
    sectionId: string,
    input: UpdateStudentInput
  ): Promise<ServiceResult<Student>> {
    try {
      // Get current roster
      const rosterResult = await this.getRoster(sectionId)
      if (!rosterResult.success) {
        return { success: false, error: rosterResult.error }
      }

      const roster = rosterResult.data
      const studentIndex = roster.students.findIndex((s) => s.id === input.id)

      if (studentIndex === -1) {
        return { success: false, error: 'Student not found' }
      }

      const existing = roster.students[studentIndex]
      const now = new Date().toISOString()

      // Merge updates
      const updated: Student = {
        ...existing,
        firstName: input.firstName ?? existing.firstName,
        lastName: input.lastName ?? existing.lastName,
        email: input.email ?? existing.email,
        studentNumber: input.studentNumber ?? existing.studentNumber,
        notes: input.notes ?? existing.notes,
        active: input.active ?? existing.active,
        updatedAt: now
      }

      roster.students[studentIndex] = updated

      // Save roster
      const saveResult = await this.saveRoster(sectionId, roster)
      if (!saveResult.success) {
        return { success: false, error: saveResult.error }
      }

      return { success: true, data: updated }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update student'
      return { success: false, error: message }
    }
  }

  /**
   * Delete a student from a section's roster
   */
  async deleteStudent(sectionId: string, studentId: string): Promise<ServiceResult<void>> {
    try {
      // Get current roster
      const rosterResult = await this.getRoster(sectionId)
      if (!rosterResult.success) {
        return { success: false, error: rosterResult.error }
      }

      const roster = rosterResult.data
      const studentIndex = roster.students.findIndex((s) => s.id === studentId)

      if (studentIndex === -1) {
        return { success: false, error: 'Student not found' }
      }

      // Hard delete - remove from array
      roster.students.splice(studentIndex, 1)

      // Save roster
      const saveResult = await this.saveRoster(sectionId, roster)
      if (!saveResult.success) {
        return { success: false, error: saveResult.error }
      }

      return { success: true, data: undefined }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete student'
      return { success: false, error: message }
    }
  }

  // ============================================================
  // Standards Operations (Multiple Collections per Course)
  // ============================================================

  /**
   * List all standards collections for a course
   */
  async listStandardsCollections(courseId: string): Promise<ServiceResult<StandardsSummary[]>> {
    try {
      // Get course to find folder ID
      const courseResult = await this.getCourse(courseId)
      if (!courseResult.success) {
        return { success: false, error: courseResult.error }
      }

      const courseFolderId = courseResult.data.driveFolderId
      if (!courseFolderId) {
        return { success: false, error: 'Course folder not found' }
      }

      // Check cache first
      const cached = this.metadataCache.standardsSummaries[courseFolderId]
      if (this.isCacheValid(cached)) {
        return { success: true, data: cached.data }
      }

      const drive = await this.getDrive()

      // Find standards folder
      const standardsFolderResponse = await drive.files.list({
        q: `name='standards' and mimeType='application/vnd.google-apps.folder' and '${courseFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (!standardsFolderResponse.data.files || standardsFolderResponse.data.files.length === 0) {
        return { success: true, data: [] }
      }

      const standardsFolderId = standardsFolderResponse.data.files[0].id!

      // List all JSON files in standards folder
      const response = await drive.files.list({
        q: `'${standardsFolderId}' in parents and mimeType='application/json' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      })

      if (!response.data.files || response.data.files.length === 0) {
        return { success: true, data: [] }
      }

      // Read each standards file and create summaries
      const summaryPromises = response.data.files.map(async (file) => {
        const fileId = file.id!
        try {
          const fileResponse = await drive.files.get({
            fileId,
            alt: 'media'
          })
          const standards = fileResponse.data as unknown as Standards

          if (!standards || !standards.id) return null

          // Count total standards across all domains
          const standardCount = standards.domains.reduce(
            (count, domain) => count + domain.standards.length,
            0
          )

          // Cache the full collection
          this.metadataCache.standardsCollections[standards.id] = {
            data: standards,
            timestamp: Date.now()
          }

          return {
            id: standards.id,
            courseId: standards.courseId,
            name: standards.name,
            state: standards.state,
            subject: standards.subject,
            gradeLevel: standards.gradeLevel,
            framework: standards.framework,
            standardCount,
            domainCount: standards.domains.length,
            updatedAt: standards.updatedAt
          } as StandardsSummary
        } catch {
          return null
        }
      })

      const summaryResults = await Promise.all(summaryPromises)
      const summaries = summaryResults.filter((s): s is StandardsSummary => s !== null)

      // Cache the summaries list
      this.metadataCache.standardsSummaries[courseFolderId] = {
        data: summaries,
        timestamp: Date.now()
      }

      return { success: true, data: summaries }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list standards collections'
      return { success: false, error: message }
    }
  }

  /**
   * Get a specific standards collection
   */
  async getStandardsCollection(
    courseId: string,
    standardsId: string
  ): Promise<ServiceResult<Standards | null>> {
    try {
      // Check cache first
      const cached = this.metadataCache.standardsCollections[standardsId]
      if (this.isCacheValid(cached)) {
        return { success: true, data: cached.data }
      }

      // Get course to find folder ID
      const courseResult = await this.getCourse(courseId)
      if (!courseResult.success) {
        return { success: false, error: courseResult.error }
      }

      const courseFolderId = courseResult.data.driveFolderId
      if (!courseFolderId) {
        return { success: false, error: 'Course folder not found' }
      }

      const drive = await this.getDrive()

      // Find standards folder
      const standardsFolderResponse = await drive.files.list({
        q: `name='standards' and mimeType='application/vnd.google-apps.folder' and '${courseFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (!standardsFolderResponse.data.files || standardsFolderResponse.data.files.length === 0) {
        return { success: true, data: null }
      }

      const standardsFolderId = standardsFolderResponse.data.files[0].id!

      // Find the specific standards file
      const response = await drive.files.list({
        q: `name='${standardsId}.json' and '${standardsFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (!response.data.files || response.data.files.length === 0) {
        return { success: true, data: null }
      }

      const fileId = response.data.files[0].id!

      // Read the file content
      const fileResponse = await drive.files.get({
        fileId,
        alt: 'media'
      })

      const standards = fileResponse.data as unknown as Standards

      // Cache the result
      if (standards) {
        this.metadataCache.standardsCollections[standardsId] = {
          data: standards,
          timestamp: Date.now()
        }
      }

      return { success: true, data: standards }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get standards collection'
      return { success: false, error: message }
    }
  }

  /**
   * Create a new standards collection
   */
  async createStandardsCollection(input: CreateStandardsInput): Promise<ServiceResult<Standards>> {
    try {
      // Get course to find folder ID
      const courseResult = await this.getCourse(input.courseId)
      if (!courseResult.success) {
        return { success: false, error: courseResult.error }
      }

      const courseFolderId = courseResult.data.driveFolderId
      if (!courseFolderId) {
        return { success: false, error: 'Course folder not found' }
      }

      const drive = await this.getDrive()
      const now = new Date().toISOString()

      // Ensure standards folder exists
      const standardsFolderId = await this.ensureSubfolder(courseFolderId, 'standards')

      // Generate unique ID for this collection
      const standardsId = this.generateUniqueId(input.name)

      const standards: Standards = {
        id: standardsId,
        courseId: input.courseId,
        version: 1,
        updatedAt: now,
        source: input.source,
        name: input.name,
        state: input.state,
        subject: input.subject,
        gradeLevel: input.gradeLevel,
        framework: input.framework,
        domains: input.domains
      }

      // Create new file with ID as filename
      await drive.files.create({
        requestBody: {
          name: `${standardsId}.json`,
          mimeType: 'application/json',
          parents: [standardsFolderId]
        },
        media: {
          mimeType: 'application/json',
          body: JSON.stringify(standards, null, 2)
        }
      })

      // Invalidate cache
      this.invalidateStandardsCache(courseFolderId, standardsId)

      return { success: true, data: standards }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create standards collection'
      return { success: false, error: message }
    }
  }

  /**
   * Update an existing standards collection
   */
  async updateStandardsCollection(input: UpdateStandardsInput): Promise<ServiceResult<Standards>> {
    try {
      // Get existing collection
      const existingResult = await this.getStandardsCollection(input.courseId, input.id)
      if (!existingResult.success) {
        return { success: false, error: existingResult.error }
      }
      if (!existingResult.data) {
        return { success: false, error: 'Standards collection not found' }
      }

      const existing = existingResult.data

      // Get course to find folder ID
      const courseResult = await this.getCourse(input.courseId)
      if (!courseResult.success) {
        return { success: false, error: courseResult.error }
      }

      const courseFolderId = courseResult.data.driveFolderId
      if (!courseFolderId) {
        return { success: false, error: 'Course folder not found' }
      }

      const drive = await this.getDrive()
      const now = new Date().toISOString()

      // Find standards folder
      const standardsFolderResponse = await drive.files.list({
        q: `name='standards' and mimeType='application/vnd.google-apps.folder' and '${courseFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (!standardsFolderResponse.data.files || standardsFolderResponse.data.files.length === 0) {
        return { success: false, error: 'Standards folder not found' }
      }

      const standardsFolderId = standardsFolderResponse.data.files[0].id!

      // Find the specific standards file
      const response = await drive.files.list({
        q: `name='${input.id}.json' and '${standardsFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (!response.data.files || response.data.files.length === 0) {
        return { success: false, error: 'Standards file not found' }
      }

      const fileId = response.data.files[0].id!

      // Merge updates
      const updated: Standards = {
        ...existing,
        name: input.name ?? existing.name,
        source: input.source ?? existing.source,
        state: input.state ?? existing.state,
        subject: input.subject ?? existing.subject,
        gradeLevel: input.gradeLevel ?? existing.gradeLevel,
        framework: input.framework ?? existing.framework,
        domains: input.domains ?? existing.domains,
        updatedAt: now,
        version: existing.version + 1
      }

      // Update the file
      await drive.files.update({
        fileId,
        media: {
          mimeType: 'application/json',
          body: JSON.stringify(updated, null, 2)
        }
      })

      // Invalidate cache
      this.invalidateStandardsCache(courseFolderId, input.id)

      return { success: true, data: updated }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update standards collection'
      return { success: false, error: message }
    }
  }

  /**
   * Delete a specific standards collection
   */
  async deleteStandardsCollection(
    courseId: string,
    standardsId: string
  ): Promise<ServiceResult<void>> {
    try {
      // Get course to find folder ID
      const courseResult = await this.getCourse(courseId)
      if (!courseResult.success) {
        return { success: false, error: courseResult.error }
      }

      const courseFolderId = courseResult.data.driveFolderId
      if (!courseFolderId) {
        return { success: false, error: 'Course folder not found' }
      }

      const drive = await this.getDrive()

      // Find standards folder
      const standardsFolderResponse = await drive.files.list({
        q: `name='standards' and mimeType='application/vnd.google-apps.folder' and '${courseFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (!standardsFolderResponse.data.files || standardsFolderResponse.data.files.length === 0) {
        return { success: true, data: undefined }
      }

      const standardsFolderId = standardsFolderResponse.data.files[0].id!

      // Find and delete the specific standards file
      const response = await drive.files.list({
        q: `name='${standardsId}.json' and '${standardsFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (response.data.files && response.data.files.length > 0) {
        await drive.files.update({
          fileId: response.data.files[0].id!,
          requestBody: { trashed: true }
        })
      }

      // Invalidate cache
      this.invalidateStandardsCache(courseFolderId, standardsId)

      return { success: true, data: undefined }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete standards collection'
      return { success: false, error: message }
    }
  }

  /**
   * Get all standards from all collections for a course (for unit creation)
   * Returns a flat list of all standards with their collection info
   */
  async getAllStandardsForCourse(courseId: string): Promise<ServiceResult<Standards[]>> {
    try {
      const summariesResult = await this.listStandardsCollections(courseId)
      if (!summariesResult.success) {
        return { success: false, error: summariesResult.error }
      }

      const summaries = summariesResult.data

      // Fetch all collections in parallel
      const collectionPromises = summaries.map((summary) =>
        this.getStandardsCollection(courseId, summary.id)
      )

      const results = await Promise.all(collectionPromises)
      const collections: Standards[] = []

      for (const result of results) {
        if (result.success && result.data) {
          collections.push(result.data)
        }
      }

      return { success: true, data: collections }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get all standards'
      return { success: false, error: message }
    }
  }

  // ============================================================
  // Unit Operations
  // ============================================================

  /**
   * List all units for a course
   */
  async listUnits(courseId: string): Promise<ServiceResult<UnitSummary[]>> {
    try {
      // Get course to find folder ID
      const courseResult = await this.getCourse(courseId)
      if (!courseResult.success) {
        return { success: false, error: courseResult.error }
      }

      const courseFolderId = courseResult.data.driveFolderId
      if (!courseFolderId) {
        return { success: false, error: 'Course folder not found' }
      }

      const drive = await this.getDrive()

      // Find units folder
      const unitsFolderId = await this.ensureSubfolder(courseFolderId, 'units')

      // List all unit folders
      const response = await drive.files.list({
        q: `'${unitsFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      })

      const folders = response.data.files ?? []

      // Fetch all unit metadata in parallel
      const unitDataPromises = folders.map(async (folder) => {
        const folderId = folder.id!

        const unit = await this.readUnitMetadata(folderId)
        if (!unit) return null

        // Populate folder cache
        this.folderCache.unitFolderIds[unit.id] = folderId

        // Count assessments in this unit
        const assessmentCount = await this.countAssessments(folderId)

        return {
          id: unit.id,
          name: unit.name,
          order: unit.order,
          assessmentCount,
          standardCount: unit.standardRefs.length,
          driveFolderId: folderId
        } as UnitSummary
      })

      const unitResults = await Promise.all(unitDataPromises)
      const units = unitResults
        .filter((u): u is UnitSummary => u !== null)
        .sort((a, b) => a.order - b.order) // Sort by order

      return { success: true, data: units }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list units'
      return { success: false, error: message }
    }
  }

  /**
   * Read unit metadata from a unit folder (with caching)
   */
  private async readUnitMetadata(unitFolderId: string): Promise<Unit | null> {
    try {
      // Check cache first
      const cached = this.metadataCache.units[unitFolderId]
      if (this.isCacheValid(cached)) {
        return cached.data
      }

      const drive = await this.getDrive()

      // Find meta.json
      const response = await drive.files.list({
        q: `name='meta.json' and '${unitFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (!response.data.files || response.data.files.length === 0) {
        return null
      }

      const fileId = response.data.files[0].id!

      // Read the file content
      const fileResponse = await drive.files.get({
        fileId,
        alt: 'media'
      })

      const unit = fileResponse.data as unknown as Unit

      // Cache the result
      if (unit) {
        this.metadataCache.units[unitFolderId] = {
          data: unit,
          timestamp: Date.now()
        }
      }

      return unit
    } catch {
      return null
    }
  }

  /**
   * Count assessments in a unit folder
   */
  private async countAssessments(unitFolderId: string): Promise<number> {
    try {
      const drive = await this.getDrive()

      // Find assessments folder
      const assessmentsFolderResponse = await drive.files.list({
        q: `name='assessments' and mimeType='application/vnd.google-apps.folder' and '${unitFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (
        !assessmentsFolderResponse.data.files ||
        assessmentsFolderResponse.data.files.length === 0
      ) {
        return 0
      }

      const assessmentsFolderId = assessmentsFolderResponse.data.files[0].id!

      // Count JSON files in assessments folder
      const response = await drive.files.list({
        q: `'${assessmentsFolderId}' in parents and mimeType='application/json' and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      return response.data.files?.length ?? 0
    } catch {
      return 0
    }
  }

  /**
   * Get a specific unit by ID
   */
  async getUnit(unitId: string): Promise<ServiceResult<Unit>> {
    try {
      const unitFolderId = this.folderCache.unitFolderIds[unitId] ?? unitId

      const unit = await this.readUnitMetadata(unitFolderId)
      if (!unit) {
        return { success: false, error: 'Unit not found' }
      }

      return { success: true, data: unit }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get unit'
      return { success: false, error: message }
    }
  }

  /**
   * Create a new unit within a course
   */
  async createUnit(input: CreateUnitInput): Promise<ServiceResult<Unit>> {
    try {
      // Get course to find folder ID
      const courseResult = await this.getCourse(input.courseId)
      if (!courseResult.success) {
        return { success: false, error: courseResult.error }
      }

      const courseFolderId = courseResult.data.driveFolderId
      if (!courseFolderId) {
        return { success: false, error: 'Course folder not found' }
      }

      const drive = await this.getDrive()

      // Get units folder
      const unitsFolderId = await this.ensureSubfolder(courseFolderId, 'units')

      // Determine order if not provided
      let order = input.order
      if (order === undefined) {
        const unitsResult = await this.listUnits(input.courseId)
        if (unitsResult.success) {
          const maxOrder = unitsResult.data.reduce((max, u) => Math.max(max, u.order), 0)
          order = maxOrder + 1
        } else {
          order = 1
        }
      }

      // Generate unique unit ID
      const unitId = this.generateUniqueId(input.name)
      const now = new Date().toISOString()

      // Create unit folder
      const folderResponse = await drive.files.create({
        requestBody: {
          name: unitId,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [unitsFolderId]
        },
        fields: 'id'
      })

      const unitFolderId = folderResponse.data.id!
      this.folderCache.unitFolderIds[unitId] = unitFolderId

      // Create assessments subfolder
      await this.ensureSubfolder(unitFolderId, 'assessments')

      // Create unit metadata
      const unit: Unit = {
        id: unitId,
        courseId: input.courseId,
        name: input.name,
        description: input.description,
        order,
        standardRefs: input.standardRefs ?? [],
        estimatedDays: input.estimatedDays,
        driveFolderId: unitFolderId,
        createdAt: now,
        updatedAt: now,
        version: 1
      }

      // Save meta.json
      await drive.files.create({
        requestBody: {
          name: 'meta.json',
          mimeType: 'application/json',
          parents: [unitFolderId]
        },
        media: {
          mimeType: 'application/json',
          body: JSON.stringify(unit, null, 2)
        }
      })

      // Invalidate unit count cache for the course
      delete this.metadataCache.unitCounts[courseFolderId]

      return { success: true, data: unit }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create unit'
      return { success: false, error: message }
    }
  }

  /**
   * Update unit metadata
   */
  async updateUnit(input: UpdateUnitInput): Promise<ServiceResult<Unit>> {
    try {
      // Get existing unit
      const existingResult = await this.getUnit(input.id)
      if (!existingResult.success) {
        return existingResult
      }
      const existing = existingResult.data

      const drive = await this.getDrive()
      const unitFolderId = existing.driveFolderId ?? this.folderCache.unitFolderIds[input.id]

      if (!unitFolderId) {
        return { success: false, error: 'Unit folder not found' }
      }

      // Find meta.json file ID
      const metaResponse = await drive.files.list({
        q: `name='meta.json' and '${unitFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (!metaResponse.data.files || metaResponse.data.files.length === 0) {
        return { success: false, error: 'Unit metadata not found' }
      }

      const metaFileId = metaResponse.data.files[0].id!

      // Update unit
      const updated: Unit = {
        ...existing,
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
        order: input.order ?? existing.order,
        standardRefs: input.standardRefs ?? existing.standardRefs,
        estimatedDays: input.estimatedDays ?? existing.estimatedDays,
        updatedAt: new Date().toISOString(),
        version: existing.version + 1
      }

      // Update the file
      await drive.files.update({
        fileId: metaFileId,
        media: {
          mimeType: 'application/json',
          body: JSON.stringify(updated, null, 2)
        }
      })

      // Get course folder ID for cache invalidation
      const courseResult = await this.getCourse(input.courseId)
      const courseFolderId = courseResult.success ? courseResult.data.driveFolderId : undefined

      // Invalidate cache
      this.invalidateUnitCache(input.id, courseFolderId)

      return { success: true, data: updated }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update unit'
      return { success: false, error: message }
    }
  }

  /**
   * Delete a unit and all its contents
   */
  async deleteUnit(unitId: string, courseId: string): Promise<ServiceResult<void>> {
    try {
      const drive = await this.getDrive()

      // Get unit folder ID
      const existingResult = await this.getUnit(unitId)
      if (!existingResult.success) {
        return { success: false, error: existingResult.error }
      }

      const unitFolderId =
        existingResult.data.driveFolderId ?? this.folderCache.unitFolderIds[unitId]

      if (!unitFolderId) {
        return { success: false, error: 'Unit folder not found' }
      }

      // Move to trash
      await drive.files.update({
        fileId: unitFolderId,
        requestBody: { trashed: true }
      })

      // Get course folder ID for cache invalidation
      const courseResult = await this.getCourse(courseId)
      const courseFolderId = courseResult.success ? courseResult.data.driveFolderId : undefined

      // Clear from caches
      delete this.folderCache.unitFolderIds[unitId]
      this.invalidateUnitCache(unitId, courseFolderId)

      return { success: true, data: undefined }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete unit'
      return { success: false, error: message }
    }
  }

  /**
   * Reorder units within a course
   */
  async reorderUnits(input: ReorderUnitsInput): Promise<ServiceResult<void>> {
    try {
      // Update each unit's order
      const updatePromises = input.unitIds.map((unitId, index) =>
        this.updateUnit({
          id: unitId,
          courseId: input.courseId,
          order: index + 1
        })
      )

      const results = await Promise.all(updatePromises)

      // Check if any failed
      const failed = results.find((r) => !r.success)
      if (failed && !failed.success) {
        return { success: false, error: failed.error }
      }

      return { success: true, data: undefined }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reorder units'
      return { success: false, error: message }
    }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * Generate a unique ID with a readable slug prefix and random suffix
   * Example: "ap-chemistry-k3m9x2"
   */
  private generateUniqueId(text: string): string {
    const slug = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const suffix = Math.random().toString(36).substring(2, 8) // 6 random chars
    return `${slug}-${suffix}`
  }

  /**
   * Generate a unique ID (for entities without a name, like students)
   */
  private generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`
  }
}

// Singleton instance
export const driveService = new DriveService()
