/**
 * AI Service for Assessment Generation and Refinement
 *
 * Orchestrates LLM calls for question generation, refinement,
 * and conversational assistance.
 */

import { llmService } from '../llm/llm.service'
import { puzzleService } from '../puzzle.service'
import sharp from 'sharp'
import {
  SYSTEM_PROMPTS,
  MATERIAL_SYSTEM_PROMPTS,
  buildQuestionGenerationPrompt,
  buildRefinementPrompt,
  buildChatContextPrompt,
  buildMaterialImportPrompt,
  buildVariantPrompt,
  buildFillInBlankConversionPrompt,
  buildLessonGoalsPrompt,
  buildLessonStructurePrompt,
  buildComponentExpansionPrompt,
  buildWorksheetPrompt,
  buildVocabularyListPrompt,
  buildPuzzleVocabularyPrompt,
  buildGraphicOrganizerPrompt,
  buildExitTicketPrompt,
  buildSVGDiagramPrompt
} from './prompts'
import {
  parseGeneratedQuestions,
  parseRefinedQuestion,
  parseMaterialImport,
  parseVariantQuestion,
  parseFillInBlankConversion,
  parseLessonGoals,
  parseLessonStructure,
  parseExpandedComponent,
  parseWorksheetContent,
  parseVocabularyList,
  parsePuzzleVocabulary,
  parseGraphicOrganizer,
  parseExitTicket
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
  LessonGenerationContext,
  LessonGoalsResult,
  LessonStructureResult,
  ComponentExpansionRequest,
  ComponentExpansionResult,
  FullLessonResult,
  LessonProgressEvent
} from '../../../shared/types/ai.types'
import type { LearningGoal, LessonComponent } from '../../../shared/types/lesson.types'
import type {
  MaterialGenerationRequest,
  PuzzleVocabularyRequest,
  GeneratedMaterial,
  DiagramGenerationResult
} from '../../../shared/types/material.types'

class AIService {
  /**
   * Generate questions with streaming progress updates
   * Sends events to renderer via IPC
   */
  async generateQuestionsWithStream(
    request: QuestionGenerationRequest,
    standardsText: string,
    sender: Electron.WebContents
  ): Promise<ServiceResult<GeneratedQuestion[]>> {
    try {
      // Send start event
      const startEvent: QuestionStreamEvent = {
        type: 'start',
        totalExpected: request.questionCount
      }
      sender.send('ai:questionStream', startEvent)

      // Build the prompt
      const prompt = buildQuestionGenerationPrompt(request, standardsText)

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
   */
  async generateQuestions(
    request: QuestionGenerationRequest,
    standardsText: string
  ): Promise<ServiceResult<GeneratedQuestion[]>> {
    try {
      const prompt = buildQuestionGenerationPrompt(request, standardsText)

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

  // ============================================================
  // Lesson Generation Methods (Phase 3)
  // ============================================================

  /**
   * Generate learning goals from standards
   */
  async generateLearningGoals(
    context: LessonGenerationContext,
    standardsText: string
  ): Promise<ServiceResult<LessonGoalsResult>> {
    try {
      const prompt = buildLessonGoalsPrompt(context, standardsText)

      const result = await llmService.complete({
        prompt,
        systemPrompt: SYSTEM_PROMPTS.lessonGoalsGeneration,
        temperature: 0.4,
        maxTokens: 2000
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      const parseResult = parseLessonGoals(result.data.content, result.data.usage)

      if (!parseResult.success || !parseResult.goals) {
        return { success: false, error: parseResult.error ?? 'Failed to parse learning goals' }
      }

      return {
        success: true,
        data: {
          goals: parseResult.goals,
          successCriteria: parseResult.successCriteria ?? [],
          usage: result.data.usage
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Learning goals generation failed'
      return { success: false, error: message }
    }
  }

  /**
   * Generate lesson structure from learning goals
   */
  async generateLessonStructure(
    context: LessonGenerationContext,
    goals: LearningGoal[],
    standardsText: string
  ): Promise<ServiceResult<LessonStructureResult>> {
    try {
      const prompt = buildLessonStructurePrompt(context, goals, standardsText)

      const result = await llmService.complete({
        prompt,
        systemPrompt: SYSTEM_PROMPTS.lessonStructureGeneration,
        temperature: 0.4,
        maxTokens: 4000
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      const parseResult = parseLessonStructure(result.data.content, result.data.usage)

      if (!parseResult.success || !parseResult.components) {
        return { success: false, error: parseResult.error ?? 'Failed to parse lesson structure' }
      }

      return {
        success: true,
        data: {
          components: parseResult.components,
          totalMinutes: parseResult.totalMinutes ?? context.durationMinutes,
          usage: result.data.usage
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lesson structure generation failed'
      return { success: false, error: message }
    }
  }

  /**
   * Expand a lesson component with detailed content
   */
  async expandComponent(
    request: ComponentExpansionRequest,
    standardsText: string
  ): Promise<ServiceResult<ComponentExpansionResult>> {
    try {
      const prompt = buildComponentExpansionPrompt(request, standardsText)

      const result = await llmService.complete({
        prompt,
        systemPrompt: SYSTEM_PROMPTS.componentExpansion,
        temperature: 0.4,
        maxTokens: 3000
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      const parseResult = parseExpandedComponent(
        result.data.content,
        request.component,
        result.data.usage
      )

      if (!parseResult.success || !parseResult.component) {
        return { success: false, error: parseResult.error ?? 'Failed to parse expanded component' }
      }

      // Merge expansion into a full LessonComponent
      const expandedComponent: LessonComponent = {
        ...request.component,
        ...parseResult.component,
        id: request.component.id,
        type: request.component.type,
        order: request.component.order
      }

      return {
        success: true,
        data: {
          expandedComponent,
          usage: result.data.usage
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Component expansion failed'
      return { success: false, error: message }
    }
  }

  /**
   * Generate a complete lesson in one call (goals + structure + expansions)
   * Sends progress events to the renderer via IPC
   */
  async generateFullLesson(
    context: LessonGenerationContext,
    standardsText: string,
    sender?: Electron.WebContents
  ): Promise<ServiceResult<FullLessonResult>> {
    try {
      // Helper to send progress events
      const sendProgress = (event: LessonProgressEvent): void => {
        sender?.send('ai:lessonProgress', event)
      }

      // Step 1: Generate learning goals
      sendProgress({ step: 'goals', status: 'generating' })
      const goalsResult = await this.generateLearningGoals(context, standardsText)

      if (!goalsResult.success) {
        sendProgress({ step: 'goals', status: 'error', error: goalsResult.error })
        return { success: false, error: `Goals generation failed: ${goalsResult.error}` }
      }
      if (!goalsResult.data) {
        sendProgress({ step: 'goals', status: 'error', error: 'No data returned' })
        return { success: false, error: 'Goals generation failed: No data returned' }
      }
      sendProgress({ step: 'goals', status: 'complete' })

      // Step 2: Generate lesson structure
      sendProgress({ step: 'structure', status: 'generating' })
      const structureResult = await this.generateLessonStructure(
        context,
        goalsResult.data.goals,
        standardsText
      )

      if (!structureResult.success) {
        sendProgress({ step: 'structure', status: 'error', error: structureResult.error })
        return { success: false, error: `Structure generation failed: ${structureResult.error}` }
      }
      if (!structureResult.data) {
        sendProgress({ step: 'structure', status: 'error', error: 'No data returned' })
        return { success: false, error: 'Structure generation failed: No data returned' }
      }
      sendProgress({ step: 'structure', status: 'complete' })

      // Step 3: Expand all components in parallel
      const components = structureResult.data.components
      sendProgress({
        step: 'expansion',
        status: 'generating',
        componentIndex: 0,
        totalComponents: components.length
      })

      const expandedComponents: LessonComponent[] = []
      let expansionUsage: LLMUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }

      // Expand components in parallel batches
      const expansionPromises = components.map(async (comp, index) => {
        const expansion = await this.expandComponent(
          {
            component: comp,
            context,
            goals: goalsResult.data.goals
          },
          standardsText
        )

        // Send progress for each completed component
        sendProgress({
          step: 'expansion',
          status: 'generating',
          componentIndex: index + 1,
          totalComponents: components.length
        })

        if (expansion.success && expansion.data) {
          expansionUsage.inputTokens += expansion.data.usage?.inputTokens ?? 0
          expansionUsage.outputTokens += expansion.data.usage?.outputTokens ?? 0
          return expansion.data.expandedComponent
        }
        // If expansion fails, return the original component
        return comp
      })

      const expanded = await Promise.all(expansionPromises)
      expandedComponents.push(...expanded)
      expansionUsage.totalTokens = expansionUsage.inputTokens + expansionUsage.outputTokens

      sendProgress({ step: 'expansion', status: 'complete' })

      // Aggregate total usage
      const totalUsage: LLMUsage = {
        inputTokens:
          (goalsResult.data.usage?.inputTokens ?? 0) +
          (structureResult.data.usage?.inputTokens ?? 0) +
          expansionUsage.inputTokens,
        outputTokens:
          (goalsResult.data.usage?.outputTokens ?? 0) +
          (structureResult.data.usage?.outputTokens ?? 0) +
          expansionUsage.outputTokens,
        totalTokens: 0
      }
      totalUsage.totalTokens = totalUsage.inputTokens + totalUsage.outputTokens

      return {
        success: true,
        data: {
          goals: goalsResult.data.goals,
          successCriteria: goalsResult.data.successCriteria,
          components: expandedComponents,
          usage: totalUsage
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Full lesson generation failed'
      return { success: false, error: message }
    }
  }

  // ============================================================
  // Material Generation Methods (Phase 5)
  // ============================================================

  /**
   * Generate a worksheet with practice questions
   */
  async generateWorksheet(
    request: MaterialGenerationRequest,
    standardsText: string
  ): Promise<ServiceResult<GeneratedMaterial>> {
    try {
      const prompt = buildWorksheetPrompt(request, standardsText)

      const result = await llmService.complete({
        prompt,
        systemPrompt: MATERIAL_SYSTEM_PROMPTS.worksheetGeneration,
        temperature: 0.4,
        maxTokens: 4000
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      const parseResult = parseWorksheetContent(result.data.content, result.data.usage)

      if (!parseResult.success) {
        return { success: false, error: parseResult.error ?? 'Failed to parse worksheet content' }
      }

      const material: GeneratedMaterial = {
        id: `mat-${Date.now().toString(36)}`,
        lessonId: request.lessonId,
        componentId: request.componentId,
        type: 'worksheet',
        name: parseResult.title ?? `${request.topic} Worksheet`,
        topic: request.topic,
        content: {
          title: parseResult.title ?? `${request.topic} Worksheet`,
          instructions: parseResult.instructions,
          questions: parseResult.questions,
          answerKey: parseResult.answerKey
        },
        aiGenerated: true,
        aiModel: result.data.model,
        generatedAt: new Date().toISOString(),
        usage: result.data.usage
      }

      return { success: true, data: material }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Worksheet generation failed'
      return { success: false, error: message }
    }
  }

  /**
   * Generate a vocabulary list
   */
  async generateVocabularyList(
    request: MaterialGenerationRequest,
    standardsText: string
  ): Promise<ServiceResult<GeneratedMaterial>> {
    try {
      const prompt = buildVocabularyListPrompt(request, standardsText)

      const result = await llmService.complete({
        prompt,
        systemPrompt: MATERIAL_SYSTEM_PROMPTS.vocabularyExtraction,
        temperature: 0.3,
        maxTokens: 3000
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      const parseResult = parseVocabularyList(result.data.content, result.data.usage)

      if (!parseResult.success) {
        return { success: false, error: parseResult.error ?? 'Failed to parse vocabulary list' }
      }

      const material: GeneratedMaterial = {
        id: `mat-${Date.now().toString(36)}`,
        lessonId: request.lessonId,
        componentId: request.componentId,
        type: 'vocabulary-list',
        name: parseResult.title ?? `${request.topic} Vocabulary`,
        topic: request.topic,
        content: {
          title: parseResult.title ?? `${request.topic} Vocabulary`,
          vocabulary: parseResult.vocabulary
        },
        aiGenerated: true,
        aiModel: result.data.model,
        generatedAt: new Date().toISOString(),
        usage: result.data.usage
      }

      return { success: true, data: material }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Vocabulary list generation failed'
      return { success: false, error: message }
    }
  }

  /**
   * Generate vocabulary for puzzle generation (words + clues)
   * Returns words/clues that can be passed to puzzle generation library
   */
  async generatePuzzleVocabulary(
    request: PuzzleVocabularyRequest
  ): Promise<ServiceResult<{ vocabulary: { word: string; clue: string }[]; usage: LLMUsage }>> {
    try {
      const prompt = buildPuzzleVocabularyPrompt(request)

      const result = await llmService.complete({
        prompt,
        systemPrompt: MATERIAL_SYSTEM_PROMPTS.vocabularyExtraction,
        temperature: 0.3,
        maxTokens: 2000
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      const parseResult = parsePuzzleVocabulary(result.data.content, result.data.usage)

      if (!parseResult.success || !parseResult.vocabulary) {
        return { success: false, error: parseResult.error ?? 'Failed to parse puzzle vocabulary' }
      }

      return {
        success: true,
        data: {
          vocabulary: parseResult.vocabulary,
          usage: result.data.usage
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Puzzle vocabulary generation failed'
      return { success: false, error: message }
    }
  }

  /**
   * Generate a graphic organizer
   */
  async generateGraphicOrganizer(
    request: MaterialGenerationRequest,
    standardsText: string
  ): Promise<ServiceResult<GeneratedMaterial>> {
    try {
      const prompt = buildGraphicOrganizerPrompt(request, standardsText)

      const result = await llmService.complete({
        prompt,
        systemPrompt: MATERIAL_SYSTEM_PROMPTS.graphicOrganizerGeneration,
        temperature: 0.4,
        maxTokens: 3000
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      const parseResult = parseGraphicOrganizer(result.data.content, result.data.usage)

      if (!parseResult.success || !parseResult.data) {
        return { success: false, error: parseResult.error ?? 'Failed to parse graphic organizer' }
      }

      const material: GeneratedMaterial = {
        id: `mat-${Date.now().toString(36)}`,
        lessonId: request.lessonId,
        componentId: request.componentId,
        type: 'graphic-organizer',
        name: parseResult.data.title ?? `${request.topic} Graphic Organizer`,
        topic: request.topic,
        content: {
          title: parseResult.data.title,
          graphicOrganizer: parseResult.data
        },
        aiGenerated: true,
        aiModel: result.data.model,
        generatedAt: new Date().toISOString(),
        usage: result.data.usage
      }

      return { success: true, data: material }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Graphic organizer generation failed'
      return { success: false, error: message }
    }
  }

  /**
   * Generate an exit ticket
   */
  async generateExitTicket(
    request: MaterialGenerationRequest,
    standardsText: string
  ): Promise<ServiceResult<GeneratedMaterial>> {
    try {
      const prompt = buildExitTicketPrompt(request, standardsText)

      const result = await llmService.complete({
        prompt,
        systemPrompt: MATERIAL_SYSTEM_PROMPTS.exitTicketGeneration,
        temperature: 0.4,
        maxTokens: 2000
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      const parseResult = parseExitTicket(result.data.content, result.data.usage)

      if (!parseResult.success || !parseResult.data) {
        return { success: false, error: parseResult.error ?? 'Failed to parse exit ticket' }
      }

      const material: GeneratedMaterial = {
        id: `mat-${Date.now().toString(36)}`,
        lessonId: request.lessonId,
        componentId: request.componentId,
        type: 'exit-ticket',
        name: parseResult.data.title ?? `${request.topic} Exit Ticket`,
        topic: request.topic,
        content: {
          title: parseResult.data.title,
          exitTicket: parseResult.data
        },
        aiGenerated: true,
        aiModel: result.data.model,
        generatedAt: new Date().toISOString(),
        usage: result.data.usage
      }

      return { success: true, data: material }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Exit ticket generation failed'
      return { success: false, error: message }
    }
  }

  /**
   * Generate an educational diagram using SVG code generation
   * Uses text LLM to generate accurate SVG, then converts to PNG
   */
  async generateDiagram(
    request: MaterialGenerationRequest
  ): Promise<ServiceResult<DiagramGenerationResult>> {
    try {
      // Build the SVG generation prompt
      const prompt = buildSVGDiagramPrompt(request)

      // Generate SVG code using text LLM
      const result = await llmService.complete({
        prompt,
        systemPrompt: 'You are an expert SVG diagram generator. Output only valid SVG code with no additional text, markdown, or explanations.',
        temperature: 0.3, // Lower temperature for more consistent output
        maxTokens: 8000 // SVG can be verbose
      })

      if (!result.success) {
        return { success: false, error: result.error }
      }

      // Extract and clean the SVG from the response
      const svgCode = this.extractSVGFromResponse(result.data.content)
      if (!svgCode) {
        // Provide helpful error with preview of what was returned
        const preview = result.data.content.substring(0, 200).replace(/\n/g, ' ')
        return {
          success: false,
          error: `Failed to generate valid SVG diagram. Response preview: "${preview}..."`
        }
      }

      // Convert SVG to PNG using sharp
      const pngResult = await this.convertSVGtoPNG(svgCode)
      if (!pngResult.success) {
        return { success: false, error: pngResult.error }
      }

      return {
        success: true,
        data: {
          imageBase64: pngResult.data,
          mimeType: 'image/png',
          promptUsed: prompt,
          usage: result.data.usage
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Diagram generation failed'
      return { success: false, error: message }
    }
  }

  /**
   * Extract SVG code from LLM response, handling various formats
   */
  private extractSVGFromResponse(response: string): string | null {
    // Log for debugging
    console.log('[SVG Extraction] Response length:', response.length)
    console.log('[SVG Extraction] Contains <svg:', response.includes('<svg'))
    console.log('[SVG Extraction] Contains </svg>:', response.includes('</svg>'))

    // Method 1: Try to find complete SVG (greedy match to last </svg>)
    const completeSvgMatch = response.match(/<svg[\s\S]*<\/svg>/i)
    if (completeSvgMatch) {
      console.log('[SVG Extraction] Found complete SVG')
      return completeSvgMatch[0]
    }

    // Method 2: Try to find SVG in markdown code block
    const codeBlockPatterns = [
      /```svg\s*([\s\S]*?)```/i,
      /```xml\s*([\s\S]*?)```/i,
      /```\s*([\s\S]*?)```/
    ]

    for (const pattern of codeBlockPatterns) {
      const match = response.match(pattern)
      if (match) {
        const content = match[1].trim()
        const svgMatch = content.match(/<svg[\s\S]*<\/svg>/i)
        if (svgMatch) {
          console.log('[SVG Extraction] Found SVG in code block')
          return svgMatch[0]
        }
      }
    }

    // Method 3: Handle truncated SVG - if it starts with <svg but has no closing tag
    if (response.includes('<svg') && !response.includes('</svg>')) {
      console.log('[SVG Extraction] SVG appears truncated, attempting repair')
      const svgStart = response.indexOf('<svg')
      let svgContent = response.substring(svgStart)

      // Try to close any open tags and add closing </svg>
      // Count open tags that need closing
      const openTags: string[] = []
      const tagRegex = /<(\w+)[^>]*(?<!\/)>/g
      const closeTagRegex = /<\/(\w+)>/g

      let match
      while ((match = tagRegex.exec(svgContent)) !== null) {
        openTags.push(match[1])
      }
      while ((match = closeTagRegex.exec(svgContent)) !== null) {
        const idx = openTags.lastIndexOf(match[1])
        if (idx !== -1) openTags.splice(idx, 1)
      }

      // Close remaining open tags in reverse order
      for (let i = openTags.length - 1; i >= 0; i--) {
        if (openTags[i] !== 'svg') {
          svgContent += `</${openTags[i]}>`
        }
      }
      svgContent += '</svg>'

      console.log('[SVG Extraction] Repaired truncated SVG')
      return svgContent
    }

    // Method 4: Check if response starts with XML declaration
    const xmlSvgMatch = response.match(/<\?xml[^>]*\?>\s*(<svg[\s\S]*<\/svg>)/i)
    if (xmlSvgMatch) {
      console.log('[SVG Extraction] Found SVG with XML declaration')
      return xmlSvgMatch[1]
    }

    console.log('[SVG Extraction] Failed to extract SVG')
    return null
  }

  /**
   * Convert SVG string to PNG using sharp
   */
  private async convertSVGtoPNG(svgCode: string): Promise<ServiceResult<string>> {
    try {
      // Ensure SVG has proper dimensions for sharp
      let processedSvg = svgCode

      // Add width/height if only viewBox is specified
      if (!svgCode.includes('width=') && svgCode.includes('viewBox')) {
        processedSvg = svgCode.replace('<svg', '<svg width="800" height="600"')
      }

      // Convert SVG to PNG buffer
      const svgBuffer = Buffer.from(processedSvg, 'utf-8')
      const pngBuffer = await sharp(svgBuffer, { density: 150 })
        .png()
        .toBuffer()

      // Convert to base64
      const base64 = pngBuffer.toString('base64')

      return { success: true, data: base64 }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to convert SVG to PNG'
      return { success: false, error: message }
    }
  }

  /**
   * Generate a diagram and wrap it in a GeneratedMaterial
   */
  private async generateDiagramMaterial(
    request: MaterialGenerationRequest
  ): Promise<ServiceResult<GeneratedMaterial>> {
    try {
      // Generate the diagram using SVG approach
      const diagramResult = await this.generateDiagram(request)

      if (!diagramResult.success) {
        return { success: false, error: diagramResult.error }
      }

      // Get the current provider/model info
      const providerInfo = llmService.getCurrentProviderInfo()

      // Create the material with the diagram image embedded
      const material: GeneratedMaterial = {
        id: crypto.randomUUID(),
        lessonId: request.lessonId,
        componentId: request.componentId,
        type: 'diagram',
        name: `${request.topic} Diagram`,
        topic: request.topic,
        content: {
          title: `${request.topic} Diagram`,
          diagramPrompt: diagramResult.data.promptUsed,
          diagramImage: diagramResult.data.imageBase64
        },
        aiGenerated: true,
        aiModel: providerInfo?.model ?? 'unknown',
        generatedAt: new Date().toISOString(),
        // Store the image as base64 for download (with data URI prefix for direct use)
        pdfBuffer: `data:${diagramResult.data.mimeType};base64,${diagramResult.data.imageBase64}`,
        usage: diagramResult.data.usage
      }

      return { success: true, data: material }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Diagram generation failed'
      return { success: false, error: message }
    }
  }

  /**
   * Generate a word search puzzle
   */
  private async generateWordSearchMaterial(
    request: MaterialGenerationRequest,
    standardsText: string
  ): Promise<ServiceResult<GeneratedMaterial>> {
    try {
      // First, extract vocabulary from the topic
      const vocabResult = await this.generatePuzzleVocabulary({
        topic: request.topic,
        gradeLevel: request.gradeLevel,
        subject: request.subject ?? '',
        wordCount: request.options?.wordCount ?? 12,
        existingContent: standardsText
      })

      if (!vocabResult.success) {
        return { success: false, error: vocabResult.error }
      }

      // Generate the word search grid
      const words = vocabResult.data.vocabulary.map((v) => v.word)
      const puzzleResult = puzzleService.generateWordSearch(
        words,
        request.options?.puzzleSize ?? 'medium'
      )

      if (!puzzleResult.success) {
        return { success: false, error: puzzleResult.error }
      }

      const material: GeneratedMaterial = {
        id: crypto.randomUUID(),
        lessonId: request.lessonId,
        componentId: request.componentId,
        type: 'word-search',
        name: `${request.topic} Word Search`,
        topic: request.topic,
        aiGenerated: true,
        aiModel: 'default',
        generatedAt: new Date().toISOString(),
        content: {
          title: `${request.topic} Word Search`,
          instructions: `Find all ${puzzleResult.data.words.length} hidden words in the puzzle below. Words may be hidden horizontally, vertically, or diagonally.`,
          wordSearch: puzzleResult.data,
          vocabulary: vocabResult.data.vocabulary.map((v) => ({
            id: crypto.randomUUID(),
            term: v.word,
            definition: v.clue
          }))
        }
      }

      return { success: true, data: material }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Word search generation failed'
      return { success: false, error: message }
    }
  }

  /**
   * Generate a crossword puzzle
   */
  private async generateCrosswordMaterial(
    request: MaterialGenerationRequest,
    standardsText: string
  ): Promise<ServiceResult<GeneratedMaterial>> {
    try {
      // First, extract vocabulary with clues from the topic
      const vocabResult = await this.generatePuzzleVocabulary({
        topic: request.topic,
        gradeLevel: request.gradeLevel,
        subject: request.subject ?? '',
        wordCount: request.options?.wordCount ?? 12,
        existingContent: standardsText
      })

      if (!vocabResult.success) {
        return { success: false, error: vocabResult.error }
      }

      // Generate the crossword grid
      const vocabulary = vocabResult.data.vocabulary.map((v) => ({
        word: v.word.toUpperCase(),
        clue: v.clue
      }))

      const puzzleResult = puzzleService.generateCrossword(vocabulary)

      if (!puzzleResult.success) {
        return { success: false, error: puzzleResult.error }
      }

      const material: GeneratedMaterial = {
        id: crypto.randomUUID(),
        lessonId: request.lessonId,
        componentId: request.componentId,
        type: 'crossword',
        name: `${request.topic} Crossword`,
        topic: request.topic,
        aiGenerated: true,
        aiModel: 'default',
        generatedAt: new Date().toISOString(),
        content: {
          title: `${request.topic} Crossword`,
          instructions: 'Complete the crossword puzzle using the clues provided below.',
          crossword: puzzleResult.data
        }
      }

      return { success: true, data: material }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Crossword generation failed'
      return { success: false, error: message }
    }
  }

  /**
   * Generate material based on type
   * Unified method that dispatches to specific generators
   */
  async generateMaterial(
    request: MaterialGenerationRequest,
    standardsText: string
  ): Promise<ServiceResult<GeneratedMaterial>> {
    switch (request.materialType) {
      case 'worksheet':
      case 'practice-problems':
        return this.generateWorksheet(request, standardsText)

      case 'vocabulary-list':
        return this.generateVocabularyList(request, standardsText)

      case 'graphic-organizer':
        return this.generateGraphicOrganizer(request, standardsText)

      case 'exit-ticket':
        return this.generateExitTicket(request, standardsText)

      case 'word-search':
        return this.generateWordSearchMaterial(request, standardsText)

      case 'crossword':
        return this.generateCrosswordMaterial(request, standardsText)

      case 'diagram':
        return this.generateDiagramMaterial(request)

      default:
        return {
          success: false,
          error: `Unknown material type: ${request.materialType}`
        }
    }
  }
}

// Singleton instance
export const aiService = new AIService()
