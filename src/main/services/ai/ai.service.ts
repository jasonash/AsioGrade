/**
 * AI Service for Assessment Generation and Refinement
 *
 * Orchestrates LLM calls for question generation, refinement,
 * and conversational assistance.
 */

import { llmService } from '../llm/llm.service'
import {
  SYSTEM_PROMPTS,
  buildQuestionGenerationPrompt,
  buildRefinementPrompt,
  buildChatContextPrompt,
  buildMaterialImportPrompt,
  buildVariantPrompt,
  buildFillInBlankConversionPrompt,
  buildDOKVariantPrompt
} from './prompts'
import {
  parseGeneratedQuestions,
  parseRefinedQuestion,
  parseMaterialImport,
  parseVariantQuestion,
  parseFillInBlankConversion,
  parseDOKVariant
} from './parser'
import type { ServiceResult } from '../../../shared/types/common.types'
import type { LLMUsage } from '../../../shared/types/llm.types'
import type {
  QuestionGenerationRequest,
  QuestionRefinementRequest,
  QuestionRefinementResult,
  GeneratedQuestion,
  AIChatRequest,
  AIChatResponse,
  AIMessage,
  QuestionStreamEvent,
  MaterialImportRequest,
  MaterialImportResult,
  VariantGenerationRequest,
  VariantGenerationResult,
  FillInBlankConversionRequest,
  FillInBlankConversionResult,
  DOKVariantGenerationRequest,
  DOKVariantGenerationResult
} from '../../../shared/types/ai.types'
import type { Assessment } from '../../../shared/types/assessment.types'

class AIService {
  /**
   * Generate questions with streaming progress updates
   * Sends events to renderer via IPC
   * @param request - The question generation request
   * @param standardsText - Formatted standards text
   * @param sender - Electron WebContents for IPC
   * @param materialContext - Optional extracted text from course materials
   */
  async generateQuestionsWithStream(
    request: QuestionGenerationRequest,
    standardsText: string,
    sender: Electron.WebContents,
    materialContext?: string
  ): Promise<ServiceResult<GeneratedQuestion[]>> {
    try {
      // Send start event
      const startEvent: QuestionStreamEvent = {
        type: 'start',
        totalExpected: request.questionCount
      }
      sender.send('ai:questionStream', startEvent)

      // Build the prompt with optional material context
      const prompt = buildQuestionGenerationPrompt(request, standardsText, materialContext)

      // Stream the response
      let fullContent = ''
      let usage: LLMUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

      for await (const chunk of llmService.stream({
        prompt,
        systemPrompt: SYSTEM_PROMPTS.questionGeneration,
        temperature: 0.4,
        maxTokens: 4000
      })) {
        fullContent += chunk.content

        // Send progress event periodically
        if (fullContent.length % 200 === 0) {
          const progressEvent: QuestionStreamEvent = {
            type: 'progress',
            message: `Generating questions... (${Math.floor(fullContent.length / 50)}% complete)`
          }
          sender.send('ai:questionStream', progressEvent)
        }

        if (chunk.usage) {
          usage = chunk.usage
        }
      }

      // Parse the complete response
      const providerType = llmService.getDefaultProviderType()
      const model = providerType ?? 'unknown'
      const parseResult = parseGeneratedQuestions(fullContent, model)

      if (!parseResult.success || !parseResult.questions) {
        const errorMsg = parseResult.error ?? 'Failed to parse generated questions'
        const errorEvent: QuestionStreamEvent = {
          type: 'error',
          message: errorMsg
        }
        sender.send('ai:questionStream', errorEvent)
        return { success: false, error: errorMsg }
      }

      // Send individual question events
      for (let i = 0; i < parseResult.questions.length; i++) {
        const questionEvent: QuestionStreamEvent = {
          type: 'question',
          question: parseResult.questions[i],
          index: i
        }
        sender.send('ai:questionStream', questionEvent)
      }

      // Send complete event
      const completeEvent: QuestionStreamEvent = {
        type: 'complete',
        questions: parseResult.questions,
        usage
      }
      sender.send('ai:questionStream', completeEvent)

      return { success: true, data: parseResult.questions }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Question generation failed'
      const errorEvent: QuestionStreamEvent = {
        type: 'error',
        message
      }
      sender.send('ai:questionStream', errorEvent)
      return { success: false, error: message }
    }
  }

  /**
   * Generate questions without streaming (for non-interactive use)
   * @param request - The question generation request
   * @param standardsText - Formatted standards text
   * @param materialContext - Optional extracted text from course materials
   */
  async generateQuestions(
    request: QuestionGenerationRequest,
    standardsText: string,
    materialContext?: string
  ): Promise<ServiceResult<GeneratedQuestion[]>> {
    try {
      const prompt = buildQuestionGenerationPrompt(request, standardsText, materialContext)

      const result = await llmService.complete({
        prompt,
        systemPrompt: SYSTEM_PROMPTS.questionGeneration,
        temperature: 0.4,
        maxTokens: 4000
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      const parseResult = parseGeneratedQuestions(result.data.content, result.data.model)
      if (!parseResult.success || !parseResult.questions) {
        return { success: false, error: parseResult.error ?? 'Failed to parse generated questions' }
      }

      return { success: true, data: parseResult.questions }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Question generation failed'
      return { success: false, error: message }
    }
  }

  /**
   * Refine a single question
   */
  async refineQuestion(
    request: QuestionRefinementRequest
  ): Promise<ServiceResult<QuestionRefinementResult>> {
    try {
      const prompt = buildRefinementPrompt(
        request.question,
        request.command,
        request.gradeLevel,
        request.standardRef
      )

      const result = await llmService.complete({
        prompt,
        systemPrompt: SYSTEM_PROMPTS.questionRefinement,
        temperature: 0.3,
        maxTokens: 2000
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      const parseResult = parseRefinedQuestion(
        result.data.content,
        request.question,
        result.data.model
      )

      if (!parseResult.success || !parseResult.question) {
        return { success: false, error: parseResult.error ?? 'Failed to parse refined question' }
      }

      return {
        success: true,
        data: {
          original: request.question,
          refined: parseResult.question,
          explanation: parseResult.explanation ?? '',
          usage: result.data.usage
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Question refinement failed'
      return { success: false, error: message }
    }
  }

  /**
   * Process a conversational chat message
   * Handles natural language requests for generation/refinement
   */
  async chat(request: AIChatRequest): Promise<ServiceResult<AIChatResponse>> {
    try {
      // Build context-aware system prompt
      const contextInfo = buildChatContextPrompt(
        request.context.assessmentTitle,
        request.context.subject,
        request.context.gradeLevel,
        request.context.standardRefs,
        request.context.existingQuestionCount
      )

      const systemPrompt = `${SYSTEM_PROMPTS.conversationalAssistant}\n\n${contextInfo}`

      const result = await llmService.complete({
        prompt: request.message,
        systemPrompt,
        temperature: 0.7,
        maxTokens: 3000
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      const message: AIMessage = {
        id: `msg-${Date.now().toString(36)}`,
        role: 'assistant',
        content: result.data.content,
        timestamp: new Date().toISOString(),
        tokenUsage: result.data.usage
      }

      // Try to extract any generated questions from the response
      const parseResult = parseGeneratedQuestions(result.data.content, result.data.model)

      return {
        success: true,
        data: {
          message,
          generatedQuestions: parseResult.success ? parseResult.questions : undefined,
          usage: result.data.usage
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Chat request failed'
      return { success: false, error: message }
    }
  }

  /**
   * Extract questions from imported material text (Phase 2)
   */
  async extractQuestionsFromMaterial(
    request: MaterialImportRequest
  ): Promise<ServiceResult<MaterialImportResult>> {
    try {
      const prompt = buildMaterialImportPrompt(request)

      const result = await llmService.complete({
        prompt,
        systemPrompt: SYSTEM_PROMPTS.materialImport,
        temperature: 0.2, // Lower temperature for extraction accuracy
        maxTokens: 4000
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      const parseResult = parseMaterialImport(result.data.content, result.data.usage)

      if (!parseResult.success || !parseResult.result) {
        return { success: false, error: parseResult.error ?? 'Failed to parse extracted questions' }
      }

      return { success: true, data: parseResult.result }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Material import failed'
      return { success: false, error: message }
    }
  }

  /**
   * Generate a variant of a question (simplified, scaffolded, or extended) (Phase 2)
   */
  async generateVariant(
    request: VariantGenerationRequest
  ): Promise<ServiceResult<VariantGenerationResult>> {
    try {
      const prompt = buildVariantPrompt(request)

      const result = await llmService.complete({
        prompt,
        systemPrompt: SYSTEM_PROMPTS.variantGeneration,
        temperature: 0.4,
        maxTokens: 2000
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      const parseResult = parseVariantQuestion(
        result.data.content,
        request.question,
        request.variantType,
        result.data.model
      )

      if (!parseResult.success || !parseResult.question) {
        return { success: false, error: parseResult.error ?? 'Failed to parse variant question' }
      }

      return {
        success: true,
        data: {
          original: request.question,
          variant: parseResult.question,
          variantType: request.variantType,
          explanation: parseResult.explanation ?? '',
          usage: result.data.usage
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Variant generation failed'
      return { success: false, error: message }
    }
  }

  /**
   * Convert fill-in-the-blank questions to multiple choice format
   * Generates plausible distractors based on the correct answer
   */
  async convertFillInBlankToMultipleChoice(
    request: FillInBlankConversionRequest
  ): Promise<ServiceResult<FillInBlankConversionResult>> {
    try {
      // Filter to only fill-in-blank questions with correct answers
      const validQuestions = request.questions.filter(
        (q) => q.type === 'fill_in_blank' && q.correctAnswer
      )

      if (validQuestions.length === 0) {
        return {
          success: false,
          error: 'No valid fill-in-the-blank questions to convert'
        }
      }

      const prompt = buildFillInBlankConversionPrompt({
        ...request,
        questions: validQuestions
      })

      const result = await llmService.complete({
        prompt,
        systemPrompt: SYSTEM_PROMPTS.fillInBlankConversion,
        temperature: 0.3, // Lower temperature for consistent distractor generation
        maxTokens: 4000
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      const parseResult = parseFillInBlankConversion(result.data.content, result.data.usage)

      if (!parseResult.success || !parseResult.questions) {
        return {
          success: false,
          error: parseResult.error ?? 'Failed to parse converted questions'
        }
      }

      return {
        success: true,
        data: {
          convertedQuestions: parseResult.questions,
          usage: result.data.usage
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Fill-in-blank conversion failed'
      return { success: false, error: message }
    }
  }

  /**
   * Generate a DOK-based variant of an entire assessment
   * Supports two strategies:
   * - "questions": Generate entirely new questions at target DOK level
   * - "distractors": Keep question stems, regenerate distractors for target DOK
   */
  async generateDOKVariant(
    request: DOKVariantGenerationRequest,
    assessment: Assessment,
    standardsText: string
  ): Promise<ServiceResult<DOKVariantGenerationResult>> {
    try {
      // Build the prompt based on strategy
      const prompt = buildDOKVariantPrompt(request, assessment, standardsText)

      // Call LLM with DOK variant system prompt
      const result = await llmService.complete({
        prompt,
        systemPrompt: SYSTEM_PROMPTS.dokVariantGeneration,
        temperature: 0.4, // Moderate creativity while maintaining accuracy
        maxTokens: 6000 // Larger token limit for full assessment variants
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      // Parse the response
      const parseResult = parseDOKVariant(
        result.data.content,
        assessment,
        request.targetDOK,
        request.strategy,
        result.data.model
      )

      if (!parseResult.success || !parseResult.variant) {
        return {
          success: false,
          error: parseResult.error ?? 'Failed to parse DOK variant'
        }
      }

      return {
        success: true,
        data: {
          variant: parseResult.variant,
          usage: result.data.usage
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DOK variant generation failed'
      return { success: false, error: message }
    }
  }
}

// Singleton instance
export const aiService = new AIService()
