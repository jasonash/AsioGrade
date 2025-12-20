import { contextBridge, ipcRenderer } from 'electron'

// Whitelist of allowed IPC channels
const validInvokeChannels = [
  // Auth
  'auth:login',
  'auth:logout',
  'auth:getStatus',
  'auth:getCurrentUser',
  'auth:isAuthenticated',

  // Google Drive - Folder Structure
  'drive:ensureAppFolder',
  'drive:ensureYearFolder',

  // Google Drive - Courses
  'drive:listCourses',
  'drive:getCourse',
  'drive:createCourse',
  'drive:updateCourse',
  'drive:deleteCourse',

  // Google Drive - Sections
  'drive:listSections',
  'drive:getSection',
  'drive:createSection',
  'drive:updateSection',
  'drive:deleteSection',

  // Google Drive - Rosters
  'drive:getRoster',
  'drive:saveRoster',
  'drive:addStudent',
  'drive:updateStudent',
  'drive:deleteStudent',

  // Google Drive - Standards
  'drive:getStandards',
  'drive:getStandardsSummary',
  'drive:saveStandards',
  'drive:deleteStandards',

  // Google Drive - Units
  'drive:listUnits',
  'drive:getUnit',
  'drive:createUnit',
  'drive:updateUnit',
  'drive:deleteUnit',
  'drive:reorderUnits',

  // Storage
  'storage:get',
  'storage:set',
  'storage:setLLMApiKey',
  'storage:setDefaultLLMProvider',
  'storage:setLLMModel',
  'storage:setLLMTemperature',
  'storage:saveDraft',
  'storage:getDraft',
  'storage:deleteDraft',
  'storage:addRecentClass',
  'storage:clear',

  // LLM
  'llm:complete',
  'llm:stream',
  'llm:testConnection',
  'llm:getProviders',

  // PDF
  'pdf:parseScantron',
  'pdf:generateScantron',
  'pdf:exportTest',

  // Grading
  'grade:process',
  'grade:exportToSheets',
  'grade:analyzeTest',

  // Window
  'window:openTestEditor',
  'window:openRoster',
  'window:minimize',
  'window:maximize',
  'window:close'
] as const

const validEventChannels = [
  'auth:statusChanged',
  'sync:progress',
  'sync:error',
  'sync:complete',
  'llm:streamChunk',
  'grade:progress'
] as const

type InvokeChannel = (typeof validInvokeChannels)[number]
type EventChannel = (typeof validEventChannels)[number]

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,

  // IPC invoke for request/response calls
  invoke: <T = unknown>(channel: InvokeChannel, ...args: unknown[]): Promise<T> => {
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args) as Promise<T>
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`))
  },

  // Event listeners for one-way messages from main process
  on: (channel: EventChannel, callback: (...args: unknown[]) => void): (() => void) => {
    if (validEventChannels.includes(channel)) {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
        callback(...args)
      }
      ipcRenderer.on(channel, subscription)
      return () => {
        ipcRenderer.removeListener(channel, subscription)
      }
    }
    console.warn(`Invalid event channel: ${channel}`)
    return () => {}
  },

  // One-time event listener
  once: (channel: EventChannel, callback: (...args: unknown[]) => void): void => {
    if (validEventChannels.includes(channel)) {
      ipcRenderer.once(channel, (_event, ...args) => callback(...args))
    } else {
      console.warn(`Invalid event channel: ${channel}`)
    }
  }
})

// Type declarations for the exposed API
export interface ElectronAPI {
  platform: NodeJS.Platform
  invoke: <T = unknown>(channel: InvokeChannel, ...args: unknown[]) => Promise<T>
  on: (channel: EventChannel, callback: (...args: unknown[]) => void) => () => void
  once: (channel: EventChannel, callback: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
