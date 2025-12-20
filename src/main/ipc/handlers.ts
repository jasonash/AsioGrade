import { ipcMain, BrowserWindow } from 'electron'
import { storageService } from '../services/storage.service'
import { authService } from '../services/auth.service'
import { driveService } from '../services/drive.service'
import { llmService } from '../services/llm'
import {
  CreateCourseInput,
  UpdateCourseInput,
  CreateSectionInput,
  UpdateSectionInput,
  Roster,
  CreateStudentInput,
  UpdateStudentInput,
  CreateStandardsInput,
  CreateUnitInput,
  UpdateUnitInput,
  ReorderUnitsInput
} from '../../shared/types'
import { LLMRequest, LLMProviderType } from '../../shared/types/llm.types'

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

  // Future handlers will be registered here:
  // registerPDFHandlers()
  // registerGradeHandlers()
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
  // Standards Operations
  // ============================================================

  // Get standards for a course
  ipcMain.handle('drive:getStandards', async (_event, courseId: string) => {
    return driveService.getStandards(courseId)
  })

  // Get standards summary for a course
  ipcMain.handle('drive:getStandardsSummary', async (_event, courseId: string) => {
    return driveService.getStandardsSummary(courseId)
  })

  // Save standards for a course
  ipcMain.handle('drive:saveStandards', async (_event, input: CreateStandardsInput) => {
    return driveService.saveStandards(input)
  })

  // Delete standards for a course
  ipcMain.handle('drive:deleteStandards', async (_event, courseId: string) => {
    return driveService.deleteStandards(courseId)
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
  ipcMain.handle('drive:deleteUnit', async (_event, unitId: string, courseId: string) => {
    return driveService.deleteUnit(unitId, courseId)
  })

  // Reorder units
  ipcMain.handle('drive:reorderUnits', async (_event, input: ReorderUnitsInput) => {
    return driveService.reorderUnits(input)
  })
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
}
