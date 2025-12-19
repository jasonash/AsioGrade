/// <reference types="vite/client" />

// Valid IPC channels (must match preload/index.ts)
type InvokeChannel =
  | 'auth:login'
  | 'auth:logout'
  | 'auth:getStatus'
  | 'auth:getCurrentUser'
  | 'auth:isAuthenticated'
  | 'drive:listClasses'
  | 'drive:getClass'
  | 'drive:createClass'
  | 'drive:deleteClass'
  | 'drive:getRoster'
  | 'drive:saveRoster'
  | 'drive:getStandards'
  | 'drive:saveStandards'
  | 'drive:getTest'
  | 'drive:saveTest'
  | 'storage:get'
  | 'storage:set'
  | 'storage:setLLMApiKey'
  | 'storage:setDefaultLLMProvider'
  | 'storage:saveDraft'
  | 'storage:getDraft'
  | 'storage:deleteDraft'
  | 'storage:addRecentClass'
  | 'storage:clear'
  | 'llm:complete'
  | 'llm:stream'
  | 'llm:testConnection'
  | 'llm:getProviders'
  | 'pdf:parseScantron'
  | 'pdf:generateScantron'
  | 'pdf:exportTest'
  | 'grade:process'
  | 'grade:exportToSheets'
  | 'grade:analyzeTest'
  | 'window:openTestEditor'
  | 'window:openRoster'
  | 'window:minimize'
  | 'window:maximize'
  | 'window:close'

type EventChannel =
  | 'auth:statusChanged'
  | 'sync:progress'
  | 'sync:error'
  | 'sync:complete'
  | 'llm:streamChunk'
  | 'grade:progress'

interface ElectronAPI {
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

export {}
