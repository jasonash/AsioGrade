import { ipcMain } from 'electron'
import { storageService } from '../services/storage.service'

/**
 * Register all IPC handlers for the main process
 * These handlers are called from the renderer via the preload script
 */
export function registerIpcHandlers(): void {
  // Storage handlers
  registerStorageHandlers()

  // Future handlers will be registered here:
  // registerAuthHandlers()
  // registerDriveHandlers()
  // registerLLMHandlers()
  // registerPDFHandlers()
  // registerGradeHandlers()
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
