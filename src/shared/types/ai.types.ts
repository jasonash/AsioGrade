/**
 * AI Feature Types for Assessment Generation and Refinement
 *
 * Types for AI-assisted question generation, refinement, and conversational assistance.
 */

import type { QuestionType, MultipleChoiceQuestion } from './question.types'
import type { LLMUsage } from './llm.types'
import type { DOKLevel } from './roster.types'
import type { VariantStrategy, AssessmentVariant } from './assessment.types'

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

  // Course materials for context (Phase 4)
  materialIds?: string[]

  // Custom teacher instructions (Phase 4)
  customPrompt?: string
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

// ============================================================
// Material Import Types (Phase 2)
// ============================================================

/**
 * Request to extract questions from uploaded document text
 */
export interface MaterialImportRequest {
  // Document content
  text: string
  sourceFileName: string

  // Context for extraction
  gradeLevel: string
  subject: string

  // Optional hints
  expectedQuestionCount?: number
}

/**
 * A question extracted from imported material
 */
export interface ExtractedQuestion {
  id: string
  text: string
  type: 'multiple_choice' | 'true_false' | 'fill_in_blank' | 'short_answer' | 'unknown'
  choices?: { id: string; text: string; isCorrect?: boolean }[]
  correctAnswer?: string // For fill_in_blank, this is the word/phrase that goes in the blank
  confidence: 'high' | 'medium' | 'low' // How confident AI is in the extraction
  notes?: string // Any notes about the extraction (e.g., "correct answer not marked")
}

// ============================================================
// Fill-in-the-Blank Conversion Types (Phase 2)
// ============================================================

/**
 * Request to convert fill-in-the-blank questions to multiple choice
 */
export interface FillInBlankConversionRequest {
  questions: ExtractedQuestion[] // Must be type 'fill_in_blank' with correctAnswer set
  gradeLevel: string
  subject: string
}

/**
 * Result of converting fill-in-the-blank to multiple choice
 */
export interface FillInBlankConversionResult {
  convertedQuestions: ExtractedQuestion[] // Now type 'multiple_choice' with choices
  usage: LLMUsage
}

/**
 * Result of material import extraction
 */
export interface MaterialImportResult {
  questions: ExtractedQuestion[]
  summary: string // Brief summary of what was found
  nonQuestionContent?: string // Content that wasn't questions but might be useful
  usage: LLMUsage
}

// ============================================================
// Coverage Analysis Types (Phase 2)
// ============================================================

/**
 * Analysis of how well an assessment covers standards
 */
export interface CoverageAnalysis {
  standardsCovered: StandardCoverage[]
  standardsUncovered: string[] // Standard refs with no questions
  recommendations: string[] // Actionable suggestions
  balance: 'good' | 'uneven' | 'poor'
  totalQuestions: number
  totalPoints: number
}

/**
 * Coverage details for a single standard
 */
export interface StandardCoverage {
  standardRef: string
  questionCount: number
  totalPoints: number
  questionIds: string[]
}

// ============================================================
// Variant Generation Types (Phase 2)
// ============================================================

export type VariantType = 'simplified' | 'scaffolded' | 'extended'

/**
 * Request to generate a variant of an existing question
 */
export interface VariantGenerationRequest {
  question: MultipleChoiceQuestion
  variantType: VariantType
  gradeLevel: string

  // For simplified
  targetReadingLevel?: string // e.g., "5th grade"

  // For scaffolded
  hintsToAdd?: number

  // For extended
  additionalComplexity?: string
}

/**
 * Result of variant generation
 */
export interface VariantGenerationResult {
  original: MultipleChoiceQuestion
  variant: MultipleChoiceQuestion
  variantType: VariantType
  explanation: string // What was changed
  usage: LLMUsage
}

// ============================================================
// DOK-Based Assessment Variant Types (Phase 5)
// ============================================================

/**
 * Request to generate a DOK-based variant of an entire assessment
 */
export interface DOKVariantGenerationRequest {
  assessmentId: string
  courseId: string
  targetDOK: DOKLevel
  strategy: VariantStrategy
  standardRefs: string[]
  gradeLevel: string
  subject: string
}

/**
 * Result of DOK variant generation
 */
export interface DOKVariantGenerationResult {
  variant: AssessmentVariant
  usage: LLMUsage
}

