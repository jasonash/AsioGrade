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
}

class DriveService {
  private drive: drive_v3.Drive | null = null
  private folderCache: FolderCache = {
    yearFolderIds: {},
    courseFolderIds: {},
    sectionFolderIds: {}
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
      sectionFolderIds: {}
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

      const courses: CourseSummary[] = []

      for (const folder of response.data.files ?? []) {
        // Read course metadata
        const course = await this.readCourseMetadata(folder.id!)
        if (course) {
          // Populate folder cache so getCourse can find this course later
          this.folderCache.courseFolderIds[course.id] = folder.id!

          // Count sections
          const sectionCount = await this.countSections(folder.id!)

          courses.push({
            id: course.id,
            name: course.name,
            subject: course.subject,
            gradeLevel: course.gradeLevel,
            academicYear: course.academicYear,
            sectionCount,
            lastModified: new Date(folder.modifiedTime ?? Date.now()).getTime(),
            driveFolderId: folder.id!
          })
        }
      }

      return { success: true, data: courses }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list courses'
      return { success: false, error: message }
    }
  }

  /**
   * Read course metadata from a course folder
   */
  private async readCourseMetadata(courseFolderId: string): Promise<Course | null> {
    try {
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

      return fileResponse.data as unknown as Course
    } catch {
      return null
    }
  }

  /**
   * Count sections in a course folder
   */
  private async countSections(courseFolderId: string): Promise<number> {
    try {
      const drive = await this.getDrive()

      // Find sections folder
      const sectionsResponse = await drive.files.list({
        q: `name='sections' and mimeType='application/vnd.google-apps.folder' and '${courseFolderId}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      if (!sectionsResponse.data.files || sectionsResponse.data.files.length === 0) {
        return 0
      }

      const sectionsFolderId = sectionsResponse.data.files[0].id!

      // Count section folders
      const response = await drive.files.list({
        q: `'${sectionsFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive'
      })

      return response.data.files?.length ?? 0
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

      // Clear from cache
      delete this.folderCache.courseFolderIds[courseId]

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

      const sections: SectionSummary[] = []

      for (const folder of response.data.files ?? []) {
        const section = await this.readSectionMetadata(folder.id!)
        if (section) {
          // Populate folder cache so getSection can find this section later
          this.folderCache.sectionFolderIds[section.id] = folder.id!

          const studentCount = await this.countStudents(folder.id!)

          sections.push({
            id: section.id,
            courseId: section.courseId,
            name: section.name,
            studentCount,
            schedule: section.schedule,
            room: section.room,
            driveFolderId: folder.id ?? undefined
          })
        }
      }

      return { success: true, data: sections }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list sections'
      return { success: false, error: message }
    }
  }

  /**
   * Read section metadata from a section folder
   */
  private async readSectionMetadata(sectionFolderId: string): Promise<Section | null> {
    try {
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

      return fileResponse.data as unknown as Section
    } catch {
      return null
    }
  }

  /**
   * Count students in a section
   */
  private async countStudents(sectionFolderId: string): Promise<number> {
    try {
      const roster = await this.readRosterFile(sectionFolderId)
      return roster?.students.filter((s) => s.active).length ?? 0
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

      // Clear from cache
      delete this.folderCache.sectionFolderIds[sectionId]

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
