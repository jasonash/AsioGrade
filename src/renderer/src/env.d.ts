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
  // Assessment Randomization (Versions A/B/C/D)
  | 'assessment:generateVersions'
  | 'assessment:clearVersions'
  // Google Drive - Assignments
  | 'drive:listAssignments'
  | 'drive:getAssignment'
  | 'drive:createAssignment'
  | 'drive:updateAssignment'
  | 'drive:deleteAssignment'
  // Google Drive - Lessons
  | 'drive:listLessons'
  | 'drive:getLesson'
  | 'drive:createLesson'
  | 'drive:updateLesson'
  | 'drive:deleteLesson'
  | 'drive:reorderLessons'
  // Google Drive - Unit Materials (legacy)
  | 'drive:listUnitMaterials'
  | 'drive:uploadUnitMaterial'
  | 'drive:deleteUnitMaterial'
  | 'drive:getUnitMaterialsContext'
  // Course Materials
  | 'material:upload'
  | 'material:list'
  | 'material:get'
  | 'material:getByIds'
  | 'material:update'
  | 'material:delete'
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
  | 'ai:extractQuestionsFromMaterial'
  | 'ai:generateVariant'
  | 'ai:convertFillInBlank'
  | 'ai:generateDOKVariant'
  // AI Lesson Generation
  | 'ai:generateLessonGoals'
  | 'ai:generateLessonStructure'
  | 'ai:expandLessonComponent'
  | 'ai:generateFullLesson'
  // AI Material Generation
  | 'ai:generateMaterial'
  | 'ai:supportsImageGeneration'
  // Material PDF Generation
  | 'material:generatePDF'
  // Import utilities
  | 'import:fetchUrl'
  | 'import:openFileDialog'
  | 'import:readTextFile'
  | 'import:readPdfText'
  | 'import:openMaterialFileDialog'
  | 'import:extractTextFromFile'
  // PDF
  | 'pdf:parseScantron'
  | 'pdf:generateScantron'
  | 'pdf:generateQuiz'
  | 'pdf:exportTest'
  | 'pdf:generateLessonPlan'
  // File operations
  | 'file:saveWithDialog'
  // Shell operations
  | 'shell:openExternal'
  // Grading
  | 'grade:processScantron'
  | 'grade:saveGrades'
  | 'grade:getGrades'
  | 'grade:applyOverrides'
  // Gradebook
  | 'grade:getGradebook'
  | 'grade:exportGradebookCSV'
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
  | 'ai:lessonProgress'

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
