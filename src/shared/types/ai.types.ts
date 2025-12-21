/**
 * AI Feature Types for Assessment Generation and Refinement
 *
 * Types for AI-assisted question generation, refinement, and conversational assistance.
 */

import type { QuestionType, MultipleChoiceQuestion } from './question.types'
import type { LLMUsage } from './llm.types'

// ============================================================
// Question Generation Types
// ============================================================

export type QuestionDifficulty = 'easy' | 'medium' | 'hard' | 'mixed'

/**
 * Request to generate questions via AI
 */
export interface QuestionGenerationRequest {
  // Context
  courseId: string
  unitId: string
  assessmentId: string

  // Standards to cover
  standardRefs: string[]

  // Configuration
  questionCount: number
  questionTypes: QuestionType[]

  // Optional constraints
  difficulty?: QuestionDifficulty
  avoidTopics?: string[]
  focusTopics?: string[]

  // Grade level (from course)
  gradeLevel: string
  subject: string
}

/**
 * Extended question with AI generation metadata
 */
export interface GeneratedQuestion extends MultipleChoiceQuestion {
  aiGenerated: true
  aiModel: string
  aiGeneratedAt: string
  explanation?: string // Why this is the correct answer
}

// ============================================================
// Streaming Event Types
// ============================================================

export type QuestionStreamEventType = 'start' | 'question' | 'progress' | 'complete' | 'error'

/**
 * Events sent during streaming question generation
 */
export interface QuestionStreamEvent {
  type: QuestionStreamEventType
  totalExpected?: number // For 'start'
  question?: GeneratedQuestion // For 'question'
  index?: number // For 'question'
  message?: string // For 'progress' and 'error'
  questions?: GeneratedQuestion[] // For 'complete'
  usage?: LLMUsage // For 'complete'
}

// ============================================================
// Question Refinement Types
// ============================================================

export type RefinementCommand =
  | 'simplify'
  | 'harder'
  | 'distractors'
  | 'rephrase'
  | 'hint'
  | 'explain'

/**
 * Request to refine a question
 */
export interface QuestionRefinementRequest {
  question: MultipleChoiceQuestion
  command: RefinementCommand
  gradeLevel: string
  standardRef?: string
  additionalContext?: string
}

/**
 * Result of question refinement
 */
export interface QuestionRefinementResult {
  original: MultipleChoiceQuestion
  refined: MultipleChoiceQuestion
  explanation: string // What was changed and why
  usage: LLMUsage
}

// ============================================================
// AI Conversation Types
// ============================================================

export type AIMessageRole = 'user' | 'assistant' | 'system'

/**
 * A single message in an AI conversation
 */
export interface AIMessage {
  id: string
  role: AIMessageRole
  content: string
  timestamp: string

  // For assistant messages that generated questions
  generatedQuestions?: string[] // Question IDs

  // Token usage tracking
  tokenUsage?: LLMUsage

  // Was this streamed?
  streamed?: boolean
}

/**
 * Full conversation history with an AI assistant
 */
export interface AIConversation {
  id: string
  assessmentId: string
  messages: AIMessage[]
  createdAt: string
  updatedAt: string
}

// ============================================================
// Chat Request/Response Types
// ============================================================

/**
 * Context about the current assessment for AI chat
 */
export interface AIAssessmentContext {
  courseId: string
  unitId: string
  assessmentTitle: string
  gradeLevel: string
  subject: string
  standardRefs: string[]
  existingQuestionCount: number
}

/**
 * Request to send a chat message
 */
export interface AIChatRequest {
  assessmentId: string
  message: string
  context: AIAssessmentContext
}

/**
 * Response from AI chat
 */
export interface AIChatResponse {
  message: AIMessage
  generatedQuestions?: GeneratedQuestion[]
  refinedQuestion?: QuestionRefinementResult
  usage: LLMUsage
}

// ============================================================
// AI Assistant UI State
// ============================================================

/**
 * State for the AI assistant panel in the UI
 */
export interface AIAssistantState {
  conversation: AIMessage[]
  isGenerating: boolean
  streamingContent: string
  pendingQuestions: GeneratedQuestion[] // Questions waiting for approval
  error: string | null
}
