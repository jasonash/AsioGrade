/**
 * AI Store
 *
 * Zustand store for AI-assisted assessment features including
 * question generation, refinement, and conversational chat.
 */

import { create } from 'zustand'
import type { ServiceResult } from '../../../shared/types/common.types'
import type { MultipleChoiceQuestion } from '../../../shared/types/question.types'
import type { LLMUsage } from '../../../shared/types/llm.types'
import type {
  GeneratedQuestion,
  AIMessage,
  QuestionGenerationRequest,
  QuestionRefinementRequest,
  QuestionRefinementResult,
  AIChatRequest,
  AIChatResponse,
  AIAssessmentContext,
  QuestionStreamEvent,
  RefinementCommand
} from '../../../shared/types/ai.types'

interface AIState {
  // Conversation state
  conversation: AIMessage[]

  // Generation state
  isGenerating: boolean
  streamingProgress: string
  pendingQuestions: GeneratedQuestion[]

  // Refinement state
  isRefining: boolean
  refinementResult: QuestionRefinementResult | null
  selectedQuestionForRefinement: MultipleChoiceQuestion | null

  // Usage tracking
  totalTokensUsed: number
  lastUsage: LLMUsage | null

  // Error state
  error: string | null

  // Actions
  generateQuestions: (request: QuestionGenerationRequest) => Promise<void>
  refineQuestion: (
    question: MultipleChoiceQuestion,
    command: RefinementCommand,
    gradeLevel: string,
    standardRef?: string
  ) => Promise<QuestionRefinementResult | null>
  sendChatMessage: (message: string, context: AIAssessmentContext) => Promise<void>

  // Pending question management
  acceptQuestion: (questionId: string) => GeneratedQuestion | undefined
  rejectQuestion: (questionId: string) => void
  acceptAllQuestions: () => GeneratedQuestion[]
  rejectAllQuestions: () => void

  // Refinement management
  setSelectedQuestionForRefinement: (question: MultipleChoiceQuestion | null) => void
  acceptRefinement: () => MultipleChoiceQuestion | null
  rejectRefinement: () => void

  // Utility actions
  clearConversation: () => void
  clearError: () => void
  addUserMessage: (content: string) => void
  addAssistantMessage: (content: string, usage?: LLMUsage) => void
}

export const useAIStore = create<AIState>((set, get) => ({
  // Initial state
  conversation: [],
  isGenerating: false,
  streamingProgress: '',
  pendingQuestions: [],
  isRefining: false,
  refinementResult: null,
  selectedQuestionForRefinement: null,
  totalTokensUsed: 0,
  lastUsage: null,
  error: null,

  generateQuestions: async (request: QuestionGenerationRequest) => {
    set({ isGenerating: true, error: null, streamingProgress: 'Starting generation...' })

    // Set up stream listener
    const cleanup = window.electronAPI.on('ai:questionStream', (event: unknown) => {
      const streamEvent = event as QuestionStreamEvent

      switch (streamEvent.type) {
        case 'start':
          set({ streamingProgress: `Generating ${streamEvent.totalExpected} questions...` })
          break
        case 'progress':
          set({ streamingProgress: streamEvent.message ?? 'Generating...' })
          break
        case 'question':
          if (streamEvent.question) {
            set((state) => ({
              pendingQuestions: [...state.pendingQuestions, streamEvent.question!],
              streamingProgress: `Generated question ${(streamEvent.index ?? 0) + 1}...`
            }))
          }
          break
        case 'complete':
          // Use questions from complete event to ensure all are captured
          // (individual 'question' events may arrive after listener cleanup due to IPC race condition)
          set((state) => ({
            isGenerating: false,
            streamingProgress: '',
            pendingQuestions: streamEvent.questions ?? state.pendingQuestions,
            lastUsage: streamEvent.usage ?? null,
            totalTokensUsed: state.totalTokensUsed + (streamEvent.usage?.totalTokens ?? 0)
          }))
          // Add assistant message about completion
          get().addAssistantMessage(
            `Generated ${streamEvent.questions?.length ?? 0} questions. Review them below and accept the ones you want to add.`,
            streamEvent.usage
          )
          break
        case 'error':
          set({
            isGenerating: false,
            streamingProgress: '',
            error: streamEvent.message ?? 'Generation failed'
          })
          break
      }
    })

    try {
      // Add user message about the request
      get().addUserMessage(
        `Generate ${request.questionCount} questions for standards: ${request.standardRefs.join(', ')}`
      )

      const result = await window.electronAPI.invoke<ServiceResult<GeneratedQuestion[]>>(
        'ai:generateQuestionsStream',
        request
      )

      // Use the invoke result directly - IPC events may not arrive before cleanup
      // This ensures we always get the questions regardless of event timing
      if (result.success && result.data) {
        // Replace pending questions with result to avoid duplicates from race condition
        set({
          isGenerating: false,
          streamingProgress: '',
          pendingQuestions: result.data
        })
        get().addAssistantMessage(
          `Generated ${result.data.length} questions. Review them below and accept the ones you want to add.`
        )
      } else {
        set({
          isGenerating: false,
          streamingProgress: '',
          error: result.error ?? 'Generation failed'
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generation failed'
      set({ isGenerating: false, error: message, streamingProgress: '' })
    } finally {
      cleanup()
    }
  },

  refineQuestion: async (
    question: MultipleChoiceQuestion,
    command: RefinementCommand,
    gradeLevel: string,
    standardRef?: string
  ) => {
    set({ isRefining: true, error: null, refinementResult: null })

    try {
      const request: QuestionRefinementRequest = {
        question,
        command,
        gradeLevel,
        standardRef
      }

      const result = await window.electronAPI.invoke<ServiceResult<QuestionRefinementResult>>(
        'ai:refineQuestion',
        request
      )

      if (result.success && result.data) {
        set((state) => ({
          isRefining: false,
          refinementResult: result.data,
          totalTokensUsed: state.totalTokensUsed + (result.data.usage?.totalTokens ?? 0),
          lastUsage: result.data.usage
        }))
        return result.data
      } else {
        set({ isRefining: false, error: result.error ?? 'Refinement failed' })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Refinement failed'
      set({ isRefining: false, error: message })
      return null
    }
  },

  sendChatMessage: async (message: string, context: AIAssessmentContext) => {
    set({ isGenerating: true, error: null })

    // Add user message immediately
    get().addUserMessage(message)

    try {
      const request: AIChatRequest = {
        assessmentId: context.unitId, // Using unitId as assessmentId for now
        message,
        context
      }

      const result = await window.electronAPI.invoke<ServiceResult<AIChatResponse>>(
        'ai:chat',
        request
      )

      if (result.success && result.data) {
        set((state) => ({
          conversation: [...state.conversation, result.data.message],
          isGenerating: false,
          totalTokensUsed: state.totalTokensUsed + (result.data.usage?.totalTokens ?? 0),
          lastUsage: result.data.usage,
          // Add any generated questions to pending
          pendingQuestions: result.data.generatedQuestions
            ? [...state.pendingQuestions, ...result.data.generatedQuestions]
            : state.pendingQuestions
        }))
      } else {
        set({ isGenerating: false, error: result.error ?? 'Chat failed' })
      }
    } catch (error) {
      const messageStr = error instanceof Error ? error.message : 'Chat failed'
      set({ isGenerating: false, error: messageStr })
    }
  },

  // Pending question management
  acceptQuestion: (questionId: string) => {
    const state = get()
    const question = state.pendingQuestions.find((q) => q.id === questionId)
    if (question) {
      set({ pendingQuestions: state.pendingQuestions.filter((q) => q.id !== questionId) })
    }
    return question
  },

  rejectQuestion: (questionId: string) => {
    set((state) => ({
      pendingQuestions: state.pendingQuestions.filter((q) => q.id !== questionId)
    }))
  },

  acceptAllQuestions: () => {
    const questions = [...get().pendingQuestions]
    set({ pendingQuestions: [] })
    return questions
  },

  rejectAllQuestions: () => {
    set({ pendingQuestions: [] })
  },

  // Refinement management
  setSelectedQuestionForRefinement: (question) => {
    set({ selectedQuestionForRefinement: question, refinementResult: null })
  },

  acceptRefinement: () => {
    const { refinementResult } = get()
    if (refinementResult) {
      set({ refinementResult: null, selectedQuestionForRefinement: null })
      return refinementResult.refined
    }
    return null
  },

  rejectRefinement: () => {
    set({ refinementResult: null })
  },

  // Utility actions
  clearConversation: () => {
    set({ conversation: [], pendingQuestions: [], refinementResult: null })
  },

  clearError: () => {
    set({ error: null })
  },

  addUserMessage: (content: string) => {
    const message: AIMessage = {
      id: `msg-${Date.now().toString(36)}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    }
    set((state) => ({ conversation: [...state.conversation, message] }))
  },

  addAssistantMessage: (content: string, usage?: LLMUsage) => {
    const message: AIMessage = {
      id: `msg-${Date.now().toString(36)}`,
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
      tokenUsage: usage
    }
    set((state) => ({ conversation: [...state.conversation, message] }))
  }
}))
