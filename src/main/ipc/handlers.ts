import { ipcMain, BrowserWindow, dialog, shell } from 'electron'
import { writeFile } from 'fs/promises'
import path from 'path'
import { storageService } from '../services/storage.service'
import { authService } from '../services/auth.service'
import { driveService } from '../services/drive.service'
import { llmService } from '../services/llm'
import { aiService } from '../services/ai'
import { importService } from '../services/import.service'
import { pdfService } from '../services/pdf.service'
import { gradeService } from '../services/grade.service'
import { randomizationService } from '../services/randomization.service'
import { scantronLookupService } from '../services/scantron-lookup.service'
import type {
  CreateCourseInput,
  UpdateCourseInput,
  CreateSectionInput,
  UpdateSectionInput,
  Roster,
  CreateStudentInput,
  UpdateStudentInput,
  CreateStandardsInput,
  UpdateStandardsInput,
  CreateAssessmentInput,
  UpdateAssessmentInput,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  ScantronGenerationRequest,
  ScantronStudentInfo,
  ScantronOptions,
  GradeProcessRequest,
  SaveGradesInput,
  AssignmentGrades,
  GradeOverride,
  UpdateMaterialInput
} from '../../shared/types'
import type { LLMRequest, LLMProviderType } from '../../shared/types/llm.types'
import type {
  QuestionGenerationRequest,
  QuestionRefinementRequest,
  AIChatRequest,
  MaterialImportRequest,
  VariantGenerationRequest,
  FillInBlankConversionRequest,
  DOKVariantGenerationRequest
} from '../../shared/types/ai.types'

/**
 * Register all IPC handlers for the main process
 * These handlers are called from the renderer via the preload script
 */
export function registerIpcHandlers(): void {
  // Auth handlers
  registerAuthHandlers()

  // Storage handlers
  registerStorageHandlers()

  // Drive handlers
  registerDriveHandlers()

  // LLM handlers
  registerLLMHandlers()

  // Import handlers
  registerImportHandlers()

  // PDF handlers
  registerPDFHandlers()

  // Grade handlers
  registerGradeHandlers()

  // AI handlers
  registerAIHandlers()

  // File handlers
  registerFileHandlers()

  // Material handlers
  registerMaterialHandlers()

  // Scantron lookup handlers (database management)
  registerScantronLookupHandlers()
}

function registerAuthHandlers(): void {
  // Login - initiates OAuth flow
  ipcMain.handle('auth:login', async () => {
    try {
      const result = await authService.login()

      // Broadcast status change to all windows
      const mainWindow = BrowserWindow.getAllWindows()[0]
      authService.broadcastAuthStatus(mainWindow ?? null)

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      return { success: false, error: message }
    }
  })

  // Logout - clears credentials
  ipcMain.handle('auth:logout', async () => {
    try {
      await authService.logout()

      // Broadcast status change to all windows
      const mainWindow = BrowserWindow.getAllWindows()[0]
      authService.broadcastAuthStatus(mainWindow ?? null)

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Logout failed'
      return { success: false, error: message }
    }
  })

  // Get current auth status (with automatic token refresh if needed)
  ipcMain.handle('auth:getStatus', async () => {
    const isConfigured = authService.isConfigured()

    // If we have stored tokens but they're expired, try to refresh
    if (isConfigured && !authService.isAuthenticated()) {
      const hasRefreshToken = authService.hasRefreshToken()
      if (hasRefreshToken) {
        try {
          await authService.refreshToken()
        } catch {
          // Refresh failed - user will need to log in again
        }
      }
    }

    return {
      success: true,
      data: {
        isAuthenticated: authService.isAuthenticated(),
        isConfigured,
        user: authService.getCurrentUser()
      }
    }
  })

  // Get current user
  ipcMain.handle('auth:getCurrentUser', () => {
    return {
      success: true,
      data: authService.getCurrentUser()
    }
  })

  // Check if authenticated
  ipcMain.handle('auth:isAuthenticated', () => {
    return {
      success: true,
      data: authService.isAuthenticated()
    }
  })
}

function registerStorageHandlers(): void {
  // Generic storage get
  ipcMain.handle('storage:get', (_event, key: string) => {
    try {
      switch (key) {
        case 'settings':
          return { success: true, data: storageService.getSettings() }
        case 'llmProviders':
          return { success: true, data: storageService.getLLMProviders() }
        case 'recentClasses':
          return { success: true, data: storageService.getRecentClasses() }
        case 'windowState':
          return { success: true, data: storageService.getWindowState() }
        case 'drafts':
          return { success: true, data: storageService.listDrafts() }
        default:
          return { success: false, error: `Unknown storage key: ${key}` }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Generic storage set
  ipcMain.handle('storage:set', (_event, key: string, value: unknown) => {
    try {
      switch (key) {
        case 'settings':
          storageService.updateSettings(value as Parameters<typeof storageService.updateSettings>[0])
          break
        case 'windowState':
          storageService.setWindowState(value as Parameters<typeof storageService.setWindowState>[0])
          break
        default:
          return { success: false, error: `Cannot set storage key: ${key}` }
      }
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // LLM API key management (secure)
  ipcMain.handle(
    'storage:setLLMApiKey',
    (_event, provider: 'openai' | 'anthropic' | 'google', apiKey: string | null) => {
      try {
        storageService.setLLMApiKey(provider, apiKey)
        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: message }
      }
    }
  )

  ipcMain.handle(
    'storage:setDefaultLLMProvider',
    (_event, provider: 'openai' | 'anthropic' | 'google' | null) => {
      try {
        storageService.setDefaultLLMProvider(provider)
        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: message }
      }
    }
  )

  ipcMain.handle(
    'storage:setLLMModel',
    (_event, provider: 'openai' | 'anthropic' | 'google', model: string) => {
      try {
        storageService.setLLMModel(provider, model)
        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: message }
      }
    }
  )

  ipcMain.handle('storage:setLLMTemperature', (_event, temperature: number) => {
    try {
      storageService.setLLMTemperature(temperature)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Draft management
  ipcMain.handle(
    'storage:saveDraft',
    (_event, draftId: string, classId: string, name: string, content: unknown) => {
      try {
        storageService.saveDraft(draftId, classId, name, content)
        return { success: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return { success: false, error: message }
      }
    }
  )

  ipcMain.handle('storage:getDraft', (_event, draftId: string) => {
    try {
      const draft = storageService.getDraft(draftId)
      return { success: true, data: draft }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('storage:deleteDraft', (_event, draftId: string) => {
    try {
      storageService.deleteDraft(draftId)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Recent classes
  ipcMain.handle('storage:addRecentClass', (_event, classId: string) => {
    try {
      storageService.addRecentClass(classId)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  // Clear storage (for logout)
  ipcMain.handle('storage:clear', () => {
    try {
      storageService.clear()
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return { success: false, error: message }
    }
  })
}

function registerDriveHandlers(): void {
  // ============================================================
  // Folder Structure
  // ============================================================

  // Initialize app folder structure
  ipcMain.handle('drive:ensureAppFolder', async () => {
    return driveService.ensureAppFolder()
  })

  // Initialize year folder structure
  ipcMain.handle('drive:ensureYearFolder', async (_event, year: string) => {
    return driveService.ensureYearFolder(year)
  })

  // ============================================================
  // Course Operations
  // ============================================================

  // List courses for a year
  ipcMain.handle('drive:listCourses', async (_event, year: string) => {
    return driveService.listCourses(year)
  })

  // Get a specific course
  ipcMain.handle('drive:getCourse', async (_event, courseId: string) => {
    return driveService.getCourse(courseId)
  })

  // Create a new course
  ipcMain.handle('drive:createCourse', async (_event, input: CreateCourseInput) => {
    return driveService.createCourse(input)
  })

  // Update a course
  ipcMain.handle('drive:updateCourse', async (_event, input: UpdateCourseInput) => {
    return driveService.updateCourse(input)
  })

  // Delete a course
  ipcMain.handle('drive:deleteCourse', async (_event, courseId: string) => {
    return driveService.deleteCourse(courseId)
  })

  // ============================================================
  // Section Operations
  // ============================================================

  // List sections for a course
  ipcMain.handle('drive:listSections', async (_event, courseId: string) => {
    return driveService.listSections(courseId)
  })

  // Get a specific section
  ipcMain.handle('drive:getSection', async (_event, sectionId: string) => {
    return driveService.getSection(sectionId)
  })

  // Create a new section
  ipcMain.handle('drive:createSection', async (_event, input: CreateSectionInput) => {
    return driveService.createSection(input)
  })

  // Update a section
  ipcMain.handle('drive:updateSection', async (_event, input: UpdateSectionInput) => {
    return driveService.updateSection(input)
  })

  // Delete a section
  ipcMain.handle('drive:deleteSection', async (_event, sectionId: string) => {
    return driveService.deleteSection(sectionId)
  })

  // ============================================================
  // Roster Operations
  // ============================================================

  // Get roster for a section
  ipcMain.handle('drive:getRoster', async (_event, sectionId: string) => {
    return driveService.getRoster(sectionId)
  })

  // Save roster for a section
  ipcMain.handle('drive:saveRoster', async (_event, sectionId: string, roster: Roster) => {
    return driveService.saveRoster(sectionId, roster)
  })

  // Add student to a section
  ipcMain.handle(
    'drive:addStudent',
    async (_event, sectionId: string, input: CreateStudentInput) => {
      return driveService.addStudent(sectionId, input)
    }
  )

  // Update student in a section
  ipcMain.handle(
    'drive:updateStudent',
    async (_event, sectionId: string, input: UpdateStudentInput) => {
      return driveService.updateStudent(sectionId, input)
    }
  )

  // Delete student from a section
  ipcMain.handle(
    'drive:deleteStudent',
    async (_event, sectionId: string, studentId: string) => {
      return driveService.deleteStudent(sectionId, studentId)
    }
  )

  // ============================================================
  // Standards Operations (Multiple Collections)
  // ============================================================

  // List all standards collections for a course
  ipcMain.handle('drive:listStandardsCollections', async (_event, courseId: string) => {
    return driveService.listStandardsCollections(courseId)
  })

  // Get a specific standards collection
  ipcMain.handle(
    'drive:getStandardsCollection',
    async (_event, courseId: string, standardsId: string) => {
      return driveService.getStandardsCollection(courseId, standardsId)
    }
  )

  // Create a new standards collection
  ipcMain.handle(
    'drive:createStandardsCollection',
    async (_event, input: CreateStandardsInput) => {
      return driveService.createStandardsCollection(input)
    }
  )

  // Update a standards collection
  ipcMain.handle(
    'drive:updateStandardsCollection',
    async (_event, input: UpdateStandardsInput) => {
      return driveService.updateStandardsCollection(input)
    }
  )

  // Delete a standards collection
  ipcMain.handle(
    'drive:deleteStandardsCollection',
    async (_event, courseId: string, standardsId: string) => {
      return driveService.deleteStandardsCollection(courseId, standardsId)
    }
  )

  // Get all standards from all collections for a course
  ipcMain.handle('drive:getAllStandardsForCourse', async (_event, courseId: string) => {
    return driveService.getAllStandardsForCourse(courseId)
  })

  // ============================================================
  // Assessment Operations
  // ============================================================

  // List assessments for a course
  ipcMain.handle('drive:listAssessments', async (_event, courseId: string) => {
    return driveService.listAssessments(courseId)
  })

  // Get a specific assessment
  ipcMain.handle('drive:getAssessment', async (_event, assessmentId: string) => {
    return driveService.getAssessment(assessmentId)
  })

  // Create a new assessment
  ipcMain.handle('drive:createAssessment', async (_event, input: CreateAssessmentInput) => {
    return driveService.createAssessment(input)
  })

  // Update an assessment
  ipcMain.handle('drive:updateAssessment', async (_event, input: UpdateAssessmentInput) => {
    return driveService.updateAssessment(input)
  })

  // Delete an assessment
  ipcMain.handle(
    'drive:deleteAssessment',
    async (_event, assessmentId: string, courseId: string) => {
      return driveService.deleteAssessment(assessmentId, courseId)
    }
  )

  // Generate randomized versions (A/B/C/D) for an assessment
  ipcMain.handle(
    'assessment:generateVersions',
    async (_event, assessmentId: string, courseId: string) => {
      try {
        // Get the assessment
        const assessmentResult = await driveService.getAssessment(assessmentId)
        if (!assessmentResult.success) {
          return { success: false, error: assessmentResult.error }
        }

        // Generate versions
        const versions = randomizationService.generateVersions(assessmentResult.data)

        // Update assessment with versions
        const updated = await driveService.updateAssessment({
          id: assessmentId,
          courseId,
          versions
        })

        return updated
      } catch (error) {
        console.error('Failed to generate versions:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate versions'
        }
      }
    }
  )

  // Clear versions from an assessment
  ipcMain.handle(
    'assessment:clearVersions',
    async (_event, assessmentId: string, courseId: string) => {
      try {
        const updated = await driveService.updateAssessment({
          id: assessmentId,
          courseId,
          versions: []
        })
        return { success: true, data: updated }
      } catch (error) {
        console.error('Failed to clear versions:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to clear versions'
        }
      }
    }
  )

  // ============================================================
  // Assignment Operations
  // ============================================================

  // List assignments for a section
  ipcMain.handle('drive:listAssignments', async (_event, sectionId: string) => {
    return driveService.listAssignments(sectionId)
  })

  // Get a specific assignment
  ipcMain.handle('drive:getAssignment', async (_event, assignmentId: string) => {
    return driveService.getAssignment(assignmentId)
  })

  // Create a new assignment
  ipcMain.handle('drive:createAssignment', async (_event, input: CreateAssignmentInput) => {
    return driveService.createAssignment(input)
  })

  // Update an assignment
  ipcMain.handle('drive:updateAssignment', async (_event, input: UpdateAssignmentInput) => {
    return driveService.updateAssignment(input)
  })

  // Delete an assignment
  ipcMain.handle(
    'drive:deleteAssignment',
    async (_event, assignmentId: string, sectionId: string) => {
      return driveService.deleteAssignment(assignmentId, sectionId)
    }
  )

}

function registerLLMHandlers(): void {
  // ============================================================
  // LLM Operations
  // ============================================================

  // Complete - send a prompt and get a full response
  ipcMain.handle('llm:complete', async (_event, request: LLMRequest) => {
    return llmService.complete(request)
  })

  // Stream - send a prompt and stream the response
  // Note: Streaming requires special handling with event emitters
  ipcMain.handle('llm:stream', async (event, request: LLMRequest) => {
    try {
      const chunks: string[] = []
      let totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

      for await (const chunk of llmService.stream(request)) {
        // Send each chunk to the renderer
        event.sender.send('llm:streamChunk', {
          content: chunk.content,
          done: chunk.done
        })

        chunks.push(chunk.content)

        if (chunk.usage) {
          totalUsage = chunk.usage
        }
      }

      return {
        success: true,
        data: {
          content: chunks.join(''),
          usage: totalUsage
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Streaming failed'
      return { success: false, error: message }
    }
  })

  // Test connection to a specific provider
  ipcMain.handle('llm:testConnection', async (_event, provider: LLMProviderType) => {
    return llmService.testConnection(provider)
  })

  // Get status of all providers
  ipcMain.handle('llm:getProviders', () => {
    return llmService.getProviders()
  })

  // Check if any provider is configured
  ipcMain.handle('llm:hasConfiguredProvider', () => {
    return { success: true, data: llmService.hasConfiguredProvider() }
  })
}

function registerImportHandlers(): void {
  // ============================================================
  // Import Operations (for Standards import from URL/File)
  // ============================================================

  // Fetch content from URL
  ipcMain.handle('import:fetchUrl', async (_event, url: string) => {
    return importService.fetchUrl(url)
  })

  // Open file dialog
  ipcMain.handle('import:openFileDialog', async () => {
    return importService.openFileDialog()
  })

  // Read text file
  ipcMain.handle('import:readTextFile', async (_event, filePath: string) => {
    return importService.readTextFile(filePath)
  })

  // Read PDF text
  ipcMain.handle('import:readPdfText', async (_event, filePath: string) => {
    return importService.readPdfText(filePath)
  })

  // ============================================================
  // Material Import Operations (Phase 2)
  // ============================================================

  // Open file dialog for material import (PDF, DOCX, TXT)
  ipcMain.handle('import:openMaterialFileDialog', async () => {
    return importService.openMaterialFileDialog()
  })

  // Extract text from any supported file type
  ipcMain.handle('import:extractTextFromFile', async (_event, filePath: string) => {
    return importService.extractTextFromFile(filePath)
  })
}

function registerPDFHandlers(): void {
  // ============================================================
  // PDF/Scantron Operations
  // ============================================================

  // Generate scantron PDF for an assignment
  ipcMain.handle('pdf:generateScantron', async (_event, request: ScantronGenerationRequest) => {
    try {
      // Get assignment
      const assignmentResult = await driveService.getAssignment(request.assignmentId)
      if (!assignmentResult.success) {
        return { success: false, error: assignmentResult.error }
      }
      const assignment = assignmentResult.data

      // Get section for name
      const sectionResult = await driveService.getSection(request.sectionId)
      if (!sectionResult.success) {
        return { success: false, error: sectionResult.error }
      }
      const section = sectionResult.data

      // Get course for name
      const courseResult = await driveService.getCourse(section.courseId)
      if (!courseResult.success) {
        return { success: false, error: courseResult.error }
      }
      const course = courseResult.data

      // Get assessment for title
      const assessmentResult = await driveService.getAssessment(assignment.assessmentId)
      if (!assessmentResult.success) {
        return { success: false, error: assessmentResult.error }
      }
      const assessment = assessmentResult.data

      // Get roster for student info
      const rosterResult = await driveService.getRoster(request.sectionId)
      if (!rosterResult.success) {
        return { success: false, error: rosterResult.error }
      }
      const roster = rosterResult.data

      // Build student info list (only active students)
      // Include DOK level (from roster or override) and assigned version
      const students: ScantronStudentInfo[] = roster.students
        .filter((s) => s.active)
        .map((s) => {
          // Find this student's assignment to get DOK override and version
          const studentAssignment = assignment.studentAssignments.find(
            (sa) => sa.studentId === s.id
          )
          // Use DOK override if set, otherwise use roster DOK
          const dokLevel = studentAssignment?.dokOverride ?? s.dokLevel
          // Use assigned version, default to 'A'
          const versionId = studentAssignment?.versionId ?? 'A'

          return {
            studentId: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            studentNumber: s.studentNumber,
            dokLevel,
            versionId
          }
        })

      if (students.length === 0) {
        return { success: false, error: 'No active students in section' }
      }

      // Generate PDF with assessment title, course name, and section name
      const result = await pdfService.generateScantronPDF(
        students,
        request.assignmentId,
        assignment.questionCount,
        request.options,
        assessment.title,
        course.name,
        section.name
      )

      // Convert Buffer to base64 for IPC transfer
      if (result.success && result.pdfBuffer) {
        return {
          success: true,
          data: {
            pdfBase64: result.pdfBuffer.toString('base64'),
            studentCount: result.studentCount,
            pageCount: result.pageCount,
            generatedAt: result.generatedAt
          }
        }
      }

      return { success: false, error: result.error ?? 'Failed to generate PDF' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate scantron'
      return { success: false, error: message }
    }
  })

  // Generate quiz PDF (single page with questions + bubbles)
  ipcMain.handle(
    'pdf:generateQuiz',
    async (
      _event,
      request: {
        assignmentId: string
        sectionId: string
        options: ScantronOptions
      }
    ) => {
      try {
        // Get assignment
        const assignmentResult = await driveService.getAssignment(request.assignmentId)
        if (!assignmentResult.success) {
          return { success: false, error: assignmentResult.error }
        }
        const assignment = assignmentResult.data

        // Get assessment (for questions, title, etc.)
        const assessmentResult = await driveService.getAssessment(assignment.assessmentId)
        if (!assessmentResult.success) {
          return { success: false, error: assessmentResult.error }
        }
        const assessment = assessmentResult.data

        // Verify this is a quiz type
        if (assessment.type !== 'quiz') {
          return { success: false, error: 'Assessment is not a quiz type' }
        }

        // Get section for course name
        const sectionResult = await driveService.getSection(request.sectionId)
        if (!sectionResult.success) {
          return { success: false, error: sectionResult.error }
        }
        const section = sectionResult.data

        // Get course for name
        const courseResult = await driveService.getCourse(section.courseId)
        if (!courseResult.success) {
          return { success: false, error: courseResult.error }
        }
        const course = courseResult.data

        // Get roster for student info
        const rosterResult = await driveService.getRoster(request.sectionId)
        if (!rosterResult.success) {
          return { success: false, error: rosterResult.error }
        }
        const roster = rosterResult.data

        // Build student info list (only active students)
        // Include DOK level (from roster or override) and assigned version
        const students: ScantronStudentInfo[] = roster.students
          .filter((s) => s.active)
          .map((s) => {
            // Find this student's assignment to get DOK override and version
            const studentAssignment = assignment.studentAssignments.find(
              (sa) => sa.studentId === s.id
            )
            // Use DOK override if set, otherwise use roster DOK
            const dokLevel = studentAssignment?.dokOverride ?? s.dokLevel
            // Use assigned version, default to 'A'
            const versionId = studentAssignment?.versionId ?? 'A'

            return {
              studentId: s.id,
              firstName: s.firstName,
              lastName: s.lastName,
              studentNumber: s.studentNumber,
              dokLevel,
              versionId
            }
          })

        if (students.length === 0) {
          return { success: false, error: 'No active students in section' }
        }

        // Build variants array for DOK-based question selection
        const variants = (assessment.variants ?? []).map((v) => ({
          dokLevel: v.dokLevel,
          questions: v.questions
        }))

        // Generate quiz PDF with DOK variant support
        const result = await pdfService.generateQuizPDF(
          students,
          request.assignmentId,
          assessment.title,
          course.name,
          section.name,
          assessment.questions,
          variants,
          request.options
        )

        // Convert Buffer to base64 for IPC transfer
        if (result.success && result.pdfBuffer) {
          return {
            success: true,
            data: {
              pdfBase64: result.pdfBuffer.toString('base64'),
              studentCount: result.studentCount,
              pageCount: result.pageCount,
              generatedAt: result.generatedAt
            }
          }
        }

        return { success: false, error: result.error ?? 'Failed to generate quiz PDF' }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate quiz PDF'
        return { success: false, error: message }
      }
    }
  )
}

function registerGradeHandlers(): void {
  // ============================================================
  // Grade Operations
  // ============================================================

  // Process scantron PDF and extract grades
  ipcMain.handle('grade:processScantron', async (_event, request: GradeProcessRequest) => {
    return gradeService.processScantronPDF(request)
  })

  // Save grades to Google Drive
  ipcMain.handle('grade:saveGrades', async (_event, input: SaveGradesInput) => {
    return gradeService.saveGrades(input)
  })

  // Get existing grades for an assignment
  ipcMain.handle(
    'grade:getGrades',
    async (_event, assignmentId: string, sectionId: string) => {
      return gradeService.getGrades(assignmentId, sectionId)
    }
  )

  // Apply overrides to grades
  ipcMain.handle(
    'grade:applyOverrides',
    async (_event, grades: AssignmentGrades, overrides: GradeOverride[]) => {
      try {
        const updated = gradeService.applyOverrides(grades, overrides)
        return { success: true, data: updated }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to apply overrides'
        return { success: false, error: message }
      }
    }
  )

  // ============================================================
  // Gradebook Operations
  // ============================================================

  // Get gradebook for a section
  ipcMain.handle('grade:getGradebook', async (_event, sectionId: string) => {
    return gradeService.getGradebook(sectionId)
  })

  // Export gradebook as CSV
  ipcMain.handle(
    'grade:exportGradebookCSV',
    async (_event, sectionId: string, includeStudentNumber?: boolean) => {
      return gradeService.exportGradebookCSV(sectionId, includeStudentNumber)
    }
  )
}

function registerAIHandlers(): void {
  // ============================================================
  // AI Assessment Generation
  // ============================================================

  // Generate questions (non-streaming)
  ipcMain.handle(
    'ai:generateQuestions',
    async (_event, request: QuestionGenerationRequest) => {
      try {
        // Fetch standards text for the prompt
        const standardsResult = await driveService.getAllStandardsForCourse(request.courseId)
        if (!standardsResult.success) {
          return { success: false, error: 'Failed to load standards' }
        }

        // Build standards text from selected refs
        const standardsText = buildStandardsText(standardsResult.data, request.standardRefs)

        // Fetch materials if materialIds provided (Phase 4)
        let materialContext: string | undefined
        if (request.materialIds && request.materialIds.length > 0) {
          const materialsResult = await driveService.getCourseMaterialsByIds(request.materialIds)
          if (materialsResult.success && materialsResult.data.length > 0) {
            materialContext = buildMaterialContext(materialsResult.data)
          }
        }

        // Fetch prompt supplements (app-level and course-level)
        const appPromptSupplement = storageService.getAIPromptSupplement()
        let coursePromptSupplement: string | undefined
        const courseResult = await driveService.getCourse(request.courseId)
        if (courseResult.success && courseResult.data.aiPromptSupplement) {
          coursePromptSupplement = courseResult.data.aiPromptSupplement
        }

        return aiService.generateQuestions(
          request,
          standardsText,
          materialContext,
          appPromptSupplement,
          coursePromptSupplement
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generation failed'
        return { success: false, error: message }
      }
    }
  )

  // Generate questions with streaming
  ipcMain.handle(
    'ai:generateQuestionsStream',
    async (event, request: QuestionGenerationRequest) => {
      try {
        const standardsResult = await driveService.getAllStandardsForCourse(request.courseId)
        if (!standardsResult.success) {
          return { success: false, error: 'Failed to load standards' }
        }

        const standardsText = buildStandardsText(standardsResult.data, request.standardRefs)

        // Fetch materials if materialIds provided (Phase 4)
        let materialContext: string | undefined
        if (request.materialIds && request.materialIds.length > 0) {
          const materialsResult = await driveService.getCourseMaterialsByIds(request.materialIds)
          if (materialsResult.success && materialsResult.data.length > 0) {
            materialContext = buildMaterialContext(materialsResult.data)
          }
        }

        // Fetch prompt supplements (app-level and course-level)
        const appPromptSupplement = storageService.getAIPromptSupplement()
        let coursePromptSupplement: string | undefined
        const courseResult = await driveService.getCourse(request.courseId)
        if (courseResult.success && courseResult.data.aiPromptSupplement) {
          coursePromptSupplement = courseResult.data.aiPromptSupplement
        }

        return aiService.generateQuestionsWithStream(
          request,
          standardsText,
          event.sender,
          materialContext,
          appPromptSupplement,
          coursePromptSupplement
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generation failed'
        return { success: false, error: message }
      }
    }
  )

  // Refine a question
  ipcMain.handle('ai:refineQuestion', async (_event, request: QuestionRefinementRequest) => {
    return aiService.refineQuestion(request)
  })

  // Conversational chat
  ipcMain.handle('ai:chat', async (_event, request: AIChatRequest) => {
    return aiService.chat(request)
  })

  // ============================================================
  // Phase 2: Material Import & Variants
  // ============================================================

  // Extract questions from imported material text
  ipcMain.handle(
    'ai:extractQuestionsFromMaterial',
    async (_event, request: MaterialImportRequest) => {
      return aiService.extractQuestionsFromMaterial(request)
    }
  )

  // Generate a question variant (simplified, scaffolded, extended)
  ipcMain.handle(
    'ai:generateVariant',
    async (_event, request: VariantGenerationRequest) => {
      return aiService.generateVariant(request)
    }
  )

  // Convert fill-in-the-blank questions to multiple choice
  ipcMain.handle(
    'ai:convertFillInBlank',
    async (_event, request: FillInBlankConversionRequest) => {
      return aiService.convertFillInBlankToMultipleChoice(request)
    }
  )

  // ============================================================
  // Phase 5: DOK-Based Assessment Variants
  // ============================================================

  // Generate DOK-based variant of an assessment
  ipcMain.handle(
    'ai:generateDOKVariant',
    async (_event, request: DOKVariantGenerationRequest) => {
      try {
        // Fetch the assessment
        const assessmentResult = await driveService.getAssessment(request.assessmentId)
        if (!assessmentResult.success || !assessmentResult.data) {
          return { success: false, error: 'Assessment not found' }
        }

        // Fetch standards text for the prompt
        const standardsResult = await driveService.getAllStandardsForCourse(request.courseId)
        if (!standardsResult.success) {
          return { success: false, error: 'Failed to load standards' }
        }

        // Build standards text from selected refs
        const standardsText = buildStandardsText(standardsResult.data, request.standardRefs)

        // Generate the variant
        return aiService.generateDOKVariant(request, assessmentResult.data, standardsText)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'DOK variant generation failed'
        return { success: false, error: message }
      }
    }
  )

}

function registerFileHandlers(): void {
  // ============================================================
  // File Save Operations (with remembered directory)
  // ============================================================

  // Save file with dialog - remembers last directory
  ipcMain.handle(
    'file:saveWithDialog',
    async (
      _event,
      options: {
        data: string // base64 encoded data
        defaultFilename: string
        filters: { name: string; extensions: string[] }[]
      }
    ) => {
      try {
        const lastDir = storageService.getLastSaveDirectory()

        const result = await dialog.showSaveDialog({
          defaultPath: lastDir
            ? path.join(lastDir, options.defaultFilename)
            : options.defaultFilename,
          filters: options.filters
        })

        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true }
        }

        // Convert base64 to buffer and write
        const buffer = Buffer.from(options.data, 'base64')
        await writeFile(result.filePath, buffer)

        // Remember the directory for next time
        const savedDir = path.dirname(result.filePath)
        storageService.setLastSaveDirectory(savedDir)

        return {
          success: true,
          filePath: result.filePath
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to save file'
        return { success: false, error: message }
      }
    }
  )

  // Open external URL in default browser
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    try {
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open URL'
      return { success: false, error: message }
    }
  })
}

function registerMaterialHandlers(): void {
  // ============================================================
  // Course Material Operations
  // ============================================================

  // Upload a material from local file path
  ipcMain.handle(
    'material:upload',
    async (_event, courseId: string, filePath: string, name: string) => {
      return driveService.uploadCourseMaterial(courseId, filePath, name)
    }
  )

  // List materials for a course
  ipcMain.handle('material:list', async (_event, courseId: string) => {
    return driveService.listCourseMaterials(courseId)
  })

  // Get a specific material (includes extracted text)
  ipcMain.handle('material:get', async (_event, materialId: string) => {
    return driveService.getCourseMaterial(materialId)
  })

  // Get multiple materials by IDs (for AI context)
  ipcMain.handle('material:getByIds', async (_event, materialIds: string[]) => {
    return driveService.getCourseMaterialsByIds(materialIds)
  })

  // Update a material (name only)
  ipcMain.handle('material:update', async (_event, input: UpdateMaterialInput) => {
    return driveService.updateCourseMaterial(input)
  })

  // Delete a material
  ipcMain.handle(
    'material:delete',
    async (_event, materialId: string, courseId: string) => {
      return driveService.deleteCourseMaterial(materialId, courseId)
    }
  )
}

/**
 * Helper to build standards text from refs
 */
function buildStandardsText(
  collections: import('../../shared/types').Standards[],
  refs: string[]
): string {
  const matchedStandards: string[] = []

  for (const collection of collections) {
    for (const domain of collection.domains) {
      for (const standard of domain.standards) {
        if (refs.includes(standard.code)) {
          matchedStandards.push(`${standard.code}: ${standard.description}`)
        }
      }
    }
  }

  return matchedStandards.length > 0
    ? matchedStandards.join('\n')
    : 'No specific standards provided. Generate general assessment questions for the subject and grade level.'
}

/**
 * Helper to build material context from course materials (Phase 4)
 * Concatenates extracted text from materials with headers
 */
function buildMaterialContext(
  materials: import('../../shared/types').CourseMaterial[]
): string {
  const sections: string[] = []

  for (const material of materials) {
    // Only include materials with successfully extracted text
    if (material.extractionStatus === 'complete' && material.extractedText) {
      // Truncate very long materials to avoid token limits
      const maxLength = 8000
      const text = material.extractedText.length > maxLength
        ? material.extractedText.slice(0, maxLength) + '\n[... content truncated for length ...]'
        : material.extractedText

      sections.push(`--- Material: ${material.name} ---\n${text}`)
    }
  }

  return sections.join('\n\n')
}

function registerScantronLookupHandlers(): void {
  // ============================================================
  // Scantron Lookup Database Operations (Phase 10: QR Code Reliability)
  // ============================================================

  // Initialize the scantron lookup database (called on app startup)
  ipcMain.handle('scantronLookup:initialize', async () => {
    try {
      scantronLookupService.initialize()
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize scantron lookup database'
      return { success: false, error: message }
    }
  })

  // Get database statistics
  ipcMain.handle('scantronLookup:getStats', async () => {
    try {
      const stats = scantronLookupService.getStats()
      return { success: true, data: stats }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get scantron lookup stats'
      return { success: false, error: message }
    }
  })

  // Clean up old records (optional maintenance)
  ipcMain.handle('scantronLookup:cleanup', async (_event, olderThanDays: number = 365) => {
    try {
      const deletedCount = scantronLookupService.cleanupOldRecords(olderThanDays)
      return { success: true, data: { deletedCount } }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clean up old records'
      return { success: false, error: message }
    }
  })

  // Get database file path (for backup purposes)
  ipcMain.handle('scantronLookup:getDbPath', async () => {
    try {
      const path = scantronLookupService.getDatabasePath()
      return { success: true, data: { path } }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get database path'
      return { success: false, error: message }
    }
  })

  // Delete lookup records for an assignment (when regenerating scantrons)
  ipcMain.handle('scantronLookup:deleteByAssignment', async (_event, assignmentId: string) => {
    try {
      const deletedCount = scantronLookupService.deleteByAssignment(assignmentId)
      return { success: true, data: { deletedCount } }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete lookup records'
      return { success: false, error: message }
    }
  })
}
