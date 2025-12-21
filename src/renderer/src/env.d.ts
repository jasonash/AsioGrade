/// <reference types="vite/client" />

// Valid IPC channels (must match preload/index.ts)
type InvokeChannel =
  // Auth
  | 'auth:login'
  | 'auth:logout'
  | 'auth:getStatus'
  | 'auth:getCurrentUser'
  | 'auth:isAuthenticated'
  // Google Drive - Folder Structure
  | 'drive:ensureAppFolder'
  | 'drive:ensureYearFolder'
  // Google Drive - Courses
  | 'drive:listCourses'
  | 'drive:getCourse'
  | 'drive:createCourse'
  | 'drive:updateCourse'
  | 'drive:deleteCourse'
  // Google Drive - Sections
  | 'drive:listSections'
  | 'drive:getSection'
  | 'drive:createSection'
  | 'drive:updateSection'
  | 'drive:deleteSection'
  // Google Drive - Rosters
  | 'drive:getRoster'
  | 'drive:saveRoster'
  | 'drive:addStudent'
  | 'drive:updateStudent'
  | 'drive:deleteStudent'
  // Google Drive - Standards (Multiple Collections)
  | 'drive:listStandardsCollections'
  | 'drive:getStandardsCollection'
  | 'drive:createStandardsCollection'
  | 'drive:updateStandardsCollection'
  | 'drive:deleteStandardsCollection'
  | 'drive:getAllStandardsForCourse'
  // Google Drive - Units
  | 'drive:listUnits'
  | 'drive:getUnit'
  | 'drive:createUnit'
  | 'drive:updateUnit'
  | 'drive:deleteUnit'
  | 'drive:reorderUnits'
  // Google Drive - Assessments
  | 'drive:listAssessments'
  | 'drive:getAssessment'
  | 'drive:createAssessment'
  | 'drive:updateAssessment'
  | 'drive:deleteAssessment'
  // Google Drive - Assignments
  | 'drive:listAssignments'
  | 'drive:getAssignment'
  | 'drive:createAssignment'
  | 'drive:updateAssignment'
  | 'drive:deleteAssignment'
  // Storage
  | 'storage:get'
  | 'storage:set'
  | 'storage:setLLMApiKey'
  | 'storage:setDefaultLLMProvider'
  | 'storage:setLLMModel'
  | 'storage:setLLMTemperature'
  | 'storage:saveDraft'
  | 'storage:getDraft'
  | 'storage:deleteDraft'
  | 'storage:addRecentClass'
  | 'storage:clear'
  // LLM
  | 'llm:complete'
  | 'llm:stream'
  | 'llm:testConnection'
  | 'llm:getProviders'
  | 'llm:hasConfiguredProvider'
  // AI Assessment Generation
  | 'ai:generateQuestions'
  | 'ai:generateQuestionsStream'
  | 'ai:refineQuestion'
  | 'ai:chat'
  // Import utilities
  | 'import:fetchUrl'
  | 'import:openFileDialog'
  | 'import:readTextFile'
  | 'import:readPdfText'
  // PDF
  | 'pdf:parseScantron'
  | 'pdf:generateScantron'
  | 'pdf:exportTest'
  // Grading
  | 'grade:processScantron'
  | 'grade:saveGrades'
  | 'grade:getGrades'
  | 'grade:applyOverrides'
  // Window
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
  | 'ai:questionStream'

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
