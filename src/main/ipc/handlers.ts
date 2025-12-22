import { ipcMain, BrowserWindow } from 'electron'
import { storageService } from '../services/storage.service'
import { authService } from '../services/auth.service'
import { driveService } from '../services/drive.service'
import { llmService } from '../services/llm'
import { aiService } from '../services/ai'
import { importService } from '../services/import.service'
import { pdfService } from '../services/pdf.service'
import { gradeService } from '../services/grade.service'
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
  CreateUnitInput,
  UpdateUnitInput,
  ReorderUnitsInput,
  CreateAssessmentInput,
  UpdateAssessmentInput,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  ScantronGenerationRequest,
  ScantronStudentInfo,
  GradeProcessRequest,
  SaveGradesInput,
  AssignmentGrades,
  GradeOverride
} from '../../shared/types'
import type { LLMRequest, LLMProviderType } from '../../shared/types/llm.types'
import type {
  QuestionGenerationRequest,
  QuestionRefinementRequest,
  AIChatRequest,
  MaterialImportRequest,
  VariantGenerationRequest
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
  // Unit Operations
  // ============================================================

  // List units for a course
  ipcMain.handle('drive:listUnits', async (_event, courseId: string) => {
    return driveService.listUnits(courseId)
  })

  // Get a specific unit
  ipcMain.handle('drive:getUnit', async (_event, unitId: string) => {
    return driveService.getUnit(unitId)
  })

  // Create a new unit
  ipcMain.handle('drive:createUnit', async (_event, input: CreateUnitInput) => {
    return driveService.createUnit(input)
  })

  // Update a unit
  ipcMain.handle('drive:updateUnit', async (_event, input: UpdateUnitInput) => {
    return driveService.updateUnit(input)
  })

  // Delete a unit
  ipcMain.handle('drive:deleteUnit', async (_event, courseId: string, unitId: string) => {
    return driveService.deleteUnit(unitId, courseId)
  })

  // Reorder units
  ipcMain.handle('drive:reorderUnits', async (_event, input: ReorderUnitsInput) => {
    return driveService.reorderUnits(input)
  })

  // ============================================================
  // Assessment Operations
  // ============================================================

  // List assessments for a unit
  ipcMain.handle('drive:listAssessments', async (_event, unitId: string) => {
    return driveService.listAssessments(unitId)
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
    async (_event, assessmentId: string, unitId: string) => {
      return driveService.deleteAssessment(assessmentId, unitId)
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

      // Get roster for student info
      const rosterResult = await driveService.getRoster(request.sectionId)
      if (!rosterResult.success) {
        return { success: false, error: rosterResult.error }
      }
      const roster = rosterResult.data

      // Build student info list (only active students)
      const students: ScantronStudentInfo[] = roster.students
        .filter((s) => s.active)
        .map((s) => ({
          studentId: s.id,
          firstName: s.firstName,
          lastName: s.lastName,
          studentNumber: s.studentNumber
        }))

      if (students.length === 0) {
        return { success: false, error: 'No active students in section' }
      }

      // Generate PDF
      const result = await pdfService.generateScantronPDF(
        students,
        request.assignmentId,
        request.sectionId,
        request.unitId,
        assignment.questionCount,
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

      return { success: false, error: result.error ?? 'Failed to generate PDF' }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate scantron'
      return { success: false, error: message }
    }
  })
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

        return aiService.generateQuestions(request, standardsText)
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

        return aiService.generateQuestionsWithStream(request, standardsText, event.sender)
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
