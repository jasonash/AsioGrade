/**
 * AI Response Parser
 *
 * Parse and validate LLM outputs for questions and refinements.
 */

import type { GeneratedQuestion, ExtractedQuestion, MaterialImportResult, VariantType } from '../../../shared/types/ai.types'
import type { MultipleChoiceQuestion, Choice } from '../../../shared/types/question.types'
import type { LLMUsage } from '../../../shared/types/llm.types'
import type { LearningGoal, LessonComponent, LessonComponentType } from '../../../shared/types/lesson.types'
import type {
  PracticeQuestion,
  VocabularyItem,
  GraphicOrganizerData,
  GraphicOrganizerTemplate,
  ExitTicketData,
  PuzzleVocabulary
} from '../../../shared/types/material.types'

export interface ParsedQuestionResult {
  success: boolean
  questions?: GeneratedQuestion[]
  error?: string
}

export interface ParsedRefinementResult {
  success: boolean
  question?: GeneratedQuestion
  explanation?: string
  error?: string
}

export interface ParsedMaterialImportResult {
  success: boolean
  result?: MaterialImportResult
  error?: string
}

export interface ParsedVariantResult {
  success: boolean
  question?: GeneratedQuestion
  explanation?: string
  error?: string
}

export interface ParsedFillInBlankConversionResult {
  success: boolean
  questions?: ExtractedQuestion[]
  error?: string
}

// ============================================
// Lesson Generation Parser Interfaces
// ============================================

export interface ParsedLessonGoalsResult {
  success: boolean
  goals?: LearningGoal[]
  successCriteria?: string[]
  error?: string
}

export interface ParsedLessonStructureResult {
  success: boolean
  components?: LessonComponent[]
  totalMinutes?: number
  error?: string
}

export interface ParsedComponentExpansionResult {
  success: boolean
  component?: Partial<LessonComponent> & { differentiation?: { support: string; extension: string }; discussionQuestions?: string[]; misconceptions?: string[]; transitionCue?: string }
  error?: string
}

/**
 * Fisher-Yates shuffle algorithm for randomizing array
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Shuffle choices and reassign IDs to randomize correct answer position
 * This counters LLM bias toward placing correct answers in early positions (A/B)
 */
function shuffleChoices(choices: Choice[]): { shuffledChoices: Choice[], correctAnswer: string } {
  // Shuffle the choices
  const shuffled = shuffleArray(choices)

  // Reassign IDs based on new positions (a, b, c, d, ...)
  const shuffledChoices = shuffled.map((choice, index) => ({
    ...choice,
    id: String.fromCharCode(97 + index) // 'a', 'b', 'c', 'd', ...
  }))

  // Find the new correct answer ID
  const correctChoice = shuffledChoices.find(c => c.isCorrect)
  const correctAnswer = correctChoice?.id ?? 'a'

  return { shuffledChoices, correctAnswer }
}

/**
 * Parse generated questions from LLM response
 */
export function parseGeneratedQuestions(
  content: string,
  model: string
): ParsedQuestionResult {
  try {
    // Try to extract JSON array from the response
    // The LLM might include extra text before/after the JSON
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return { success: false, error: 'No JSON array found in response' }
    }

    const parsed: unknown = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed)) {
      return { success: false, error: 'Response is not an array' }
    }

    const questions: GeneratedQuestion[] = []
    const now = new Date().toISOString()

    for (let index = 0; index < parsed.length; index++) {
      const q = parsed[index] as Record<string, unknown>

      // Validate required fields
      if (typeof q.text !== 'string' || !q.text.trim()) {
        throw new Error(`Question ${index + 1} missing required "text" field`)
      }

      if (!Array.isArray(q.choices) || q.choices.length < 2) {
        throw new Error(`Question ${index + 1} must have at least 2 choices`)
      }

      // Normalize choices
      const choices: Choice[] = q.choices.map((c: unknown, ci: number) => {
        const choice = c as Record<string, unknown>
        const choiceId = typeof choice.id === 'string'
          ? choice.id.toLowerCase()
          : String.fromCharCode(97 + ci) // 'a', 'b', 'c', 'd'

        return {
          id: choiceId,
          text: String(choice.text ?? ''),
          isCorrect: Boolean(choice.isCorrect)
        }
      })

      // Ensure exactly one correct answer
      const correctChoices = choices.filter(c => c.isCorrect)
      if (correctChoices.length === 0) {
        // Try to use correctAnswer field
        const correctAnswerFromLLM = String(q.correctAnswer ?? 'a').toLowerCase()
        const correctChoice = choices.find(c => c.id === correctAnswerFromLLM)
        if (correctChoice) {
          correctChoice.isCorrect = true
        } else {
          choices[0].isCorrect = true // Fallback to first choice
        }
      } else if (correctChoices.length > 1) {
        // Only keep first as correct
        correctChoices.slice(1).forEach(c => { c.isCorrect = false })
      }

      // Shuffle choices to randomize correct answer position
      // This counters LLM bias toward placing correct answers in A/B positions
      const { shuffledChoices, correctAnswer } = shuffleChoices(choices)

      // Build the generated question
      const question: GeneratedQuestion = {
        id: `q-${Date.now().toString(36)}-${index}`,
        type: 'multiple_choice' as const,
        text: String(q.text).trim(),
        choices: shuffledChoices,
        correctAnswer,
        standardRef: typeof q.standardRef === 'string' ? q.standardRef : undefined,
        points: typeof q.points === 'number' ? q.points : 1,
        createdAt: now,
        explanation: typeof q.explanation === 'string' ? q.explanation : undefined,
        aiGenerated: true as const,
        aiModel: model,
        aiGeneratedAt: now
      }

      questions.push(question)
    }

    return { success: true, questions }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse questions'
    return { success: false, error: message }
  }
}

/**
 * Parse refined question from LLM response
 */
export function parseRefinedQuestion(
  content: string,
  original: MultipleChoiceQuestion,
  model: string
): ParsedRefinementResult {
  try {
    // Try to extract JSON object from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, error: 'No JSON object found in response' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const now = new Date().toISOString()

    // Use original values as defaults, override with parsed values
    const text = typeof parsed.text === 'string' && parsed.text.trim()
      ? parsed.text.trim()
      : original.text

    // Parse choices if provided, otherwise keep original
    let choices: Choice[]
    if (Array.isArray(parsed.choices) && parsed.choices.length >= 2) {
      choices = parsed.choices.map((c: unknown, ci: number) => {
        const choice = c as Record<string, unknown>
        const choiceId = typeof choice.id === 'string'
          ? choice.id.toLowerCase()
          : String.fromCharCode(97 + ci)

        return {
          id: choiceId,
          text: String(choice.text ?? ''),
          isCorrect: Boolean(choice.isCorrect)
        }
      })

      // Ensure exactly one correct answer
      const correctChoices = choices.filter(c => c.isCorrect)
      if (correctChoices.length === 0) {
        const correctAnswer = String(parsed.correctAnswer ?? original.correctAnswer).toLowerCase()
        const correctChoice = choices.find(c => c.id === correctAnswer)
        if (correctChoice) {
          correctChoice.isCorrect = true
        } else {
          choices[0].isCorrect = true
        }
      } else if (correctChoices.length > 1) {
        correctChoices.slice(1).forEach(c => { c.isCorrect = false })
      }
    } else {
      choices = original.choices
    }

    const correctChoice = choices.find(c => c.isCorrect)
    const correctAnswer = correctChoice?.id ?? original.correctAnswer

    // Build the refined question
    const question: GeneratedQuestion = {
      id: original.id, // Keep same ID for refinement
      type: 'multiple_choice' as const,
      text,
      choices,
      correctAnswer,
      standardRef: typeof parsed.standardRef === 'string'
        ? parsed.standardRef
        : original.standardRef,
      points: typeof parsed.points === 'number'
        ? parsed.points
        : original.points,
      createdAt: original.createdAt,
      explanation: typeof parsed.explanation === 'string'
        ? parsed.explanation
        : original.explanation,
      aiGenerated: true as const,
      aiModel: model,
      aiGeneratedAt: now
    }

    // Extract the explanation of changes
    const changeExplanation = typeof parsed.explanation === 'string'
      ? parsed.explanation
      : 'Question refined successfully'

    return {
      success: true,
      question,
      explanation: changeExplanation
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse refined question'
    return { success: false, error: message }
  }
}

/**
 * Parse extracted questions from material import LLM response
 */
export function parseMaterialImport(
  content: string,
  usage: LLMUsage
): ParsedMaterialImportResult {
  try {
    // Try to extract JSON object from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, error: 'No JSON object found in response' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    // Parse questions array
    const questions: ExtractedQuestion[] = []
    if (Array.isArray(parsed.questions)) {
      for (let index = 0; index < parsed.questions.length; index++) {
        const q = parsed.questions[index] as Record<string, unknown>

        // Skip if no text
        if (typeof q.text !== 'string' || !q.text.trim()) {
          continue
        }

        // Determine question type
        let type: ExtractedQuestion['type'] = 'unknown'
        if (typeof q.type === 'string') {
          const typeStr = q.type.toLowerCase()
          if (typeStr.includes('multiple') || typeStr.includes('choice')) {
            type = 'multiple_choice'
          } else if (typeStr.includes('true') || typeStr.includes('false')) {
            type = 'true_false'
          } else if (typeStr.includes('fill') || typeStr.includes('blank')) {
            type = 'fill_in_blank'
          } else if (typeStr.includes('short') || typeStr.includes('answer')) {
            type = 'short_answer'
          }
        }

        // Parse choices if present
        let choices: ExtractedQuestion['choices']
        if (Array.isArray(q.choices) && q.choices.length > 0) {
          choices = q.choices.map((c: unknown, ci: number) => {
            const choice = c as Record<string, unknown>
            return {
              id: typeof choice.id === 'string' ? choice.id.toLowerCase() : String.fromCharCode(97 + ci),
              text: String(choice.text ?? ''),
              isCorrect: Boolean(choice.isCorrect)
            }
          })
        }

        // Determine confidence
        let confidence: ExtractedQuestion['confidence'] = 'medium'
        if (typeof q.confidence === 'string') {
          const confStr = q.confidence.toLowerCase()
          if (confStr === 'high') confidence = 'high'
          else if (confStr === 'low') confidence = 'low'
        }

        questions.push({
          id: `ext-${Date.now().toString(36)}-${index}`,
          text: String(q.text).trim(),
          type,
          choices,
          correctAnswer: typeof q.correctAnswer === 'string' ? q.correctAnswer.toLowerCase() : undefined,
          confidence,
          notes: typeof q.notes === 'string' ? q.notes : undefined
        })
      }
    }

    const result: MaterialImportResult = {
      questions,
      summary: typeof parsed.summary === 'string' ? parsed.summary : `Found ${questions.length} questions`,
      nonQuestionContent: typeof parsed.nonQuestionContent === 'string' ? parsed.nonQuestionContent : undefined,
      usage
    }

    return { success: true, result }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse extracted questions'
    return { success: false, error: message }
  }
}

/**
 * Parse variant question from LLM response
 */
export function parseVariantQuestion(
  content: string,
  original: MultipleChoiceQuestion,
  variantType: VariantType,
  model: string
): ParsedVariantResult {
  try {
    // Try to extract JSON object from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, error: 'No JSON object found in response' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const now = new Date().toISOString()

    // Use original values as defaults, override with parsed values
    const text = typeof parsed.text === 'string' && parsed.text.trim()
      ? parsed.text.trim()
      : original.text

    // Parse choices if provided
    let choices: Choice[]
    if (Array.isArray(parsed.choices) && parsed.choices.length >= 2) {
      choices = parsed.choices.map((c: unknown, ci: number) => {
        const choice = c as Record<string, unknown>
        const choiceId = typeof choice.id === 'string'
          ? choice.id.toLowerCase()
          : String.fromCharCode(97 + ci)

        return {
          id: choiceId,
          text: String(choice.text ?? ''),
          isCorrect: Boolean(choice.isCorrect)
        }
      })

      // Ensure exactly one correct answer
      const correctChoices = choices.filter(c => c.isCorrect)
      if (correctChoices.length === 0) {
        const correctAnswer = String(parsed.correctAnswer ?? original.correctAnswer).toLowerCase()
        const correctChoice = choices.find(c => c.id === correctAnswer)
        if (correctChoice) {
          correctChoice.isCorrect = true
        } else {
          choices[0].isCorrect = true
        }
      } else if (correctChoices.length > 1) {
        correctChoices.slice(1).forEach(c => { c.isCorrect = false })
      }
    } else {
      choices = original.choices
    }

    const correctChoice = choices.find(c => c.isCorrect)
    const correctAnswer = correctChoice?.id ?? original.correctAnswer

    // Build the variant question with a new ID
    const question: GeneratedQuestion = {
      id: `var-${Date.now().toString(36)}-${variantType}`,
      type: 'multiple_choice' as const,
      text,
      choices,
      correctAnswer,
      standardRef: original.standardRef,
      points: original.points,
      createdAt: now,
      explanation: typeof parsed.explanation === 'string' ? parsed.explanation : undefined,
      aiGenerated: true as const,
      aiModel: model,
      aiGeneratedAt: now
    }

    const changeExplanation = typeof parsed.explanation === 'string'
      ? parsed.explanation
      : `${variantType} variant created`

    return {
      success: true,
      question,
      explanation: changeExplanation
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse variant question'
    return { success: false, error: message }
  }
}

/**
 * Parse converted fill-in-the-blank questions from LLM response
 */
export function parseFillInBlankConversion(
  content: string,
  _usage: LLMUsage
): ParsedFillInBlankConversionResult {
  try {
    // Try to extract JSON array from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return { success: false, error: 'No JSON array found in response' }
    }

    const parsed: unknown = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed)) {
      return { success: false, error: 'Response is not an array' }
    }

    const questions: ExtractedQuestion[] = []

    for (let index = 0; index < parsed.length; index++) {
      const q = parsed[index] as Record<string, unknown>

      // Skip if no text
      if (typeof q.text !== 'string' || !q.text.trim()) {
        continue
      }

      // Parse choices - required for conversion
      if (!Array.isArray(q.choices) || q.choices.length < 2) {
        continue
      }

      const choices = q.choices.map((c: unknown, ci: number) => {
        const choice = c as Record<string, unknown>
        return {
          id: typeof choice.id === 'string' ? choice.id.toLowerCase() : String.fromCharCode(97 + ci),
          text: String(choice.text ?? ''),
          isCorrect: Boolean(choice.isCorrect)
        }
      })

      // Ensure exactly one correct answer
      const correctChoices = choices.filter(c => c.isCorrect)
      if (correctChoices.length === 0) {
        // Try to use correctAnswer field
        const correctAnswerFromLLM = String(q.correctAnswer ?? 'a').toLowerCase()
        const correctChoice = choices.find(c => c.id === correctAnswerFromLLM)
        if (correctChoice) {
          correctChoice.isCorrect = true
        } else {
          choices[0].isCorrect = true
        }
      } else if (correctChoices.length > 1) {
        correctChoices.slice(1).forEach(c => { c.isCorrect = false })
      }

      const correctChoice = choices.find(c => c.isCorrect)

      questions.push({
        // Keep original ID if provided, otherwise generate new one
        id: typeof q.id === 'string' ? q.id : `conv-${Date.now().toString(36)}-${index}`,
        text: String(q.text).trim(),
        type: 'multiple_choice',
        choices,
        correctAnswer: correctChoice?.id ?? 'a',
        confidence: 'high', // Converted questions should be high confidence
        notes: 'Converted from fill-in-the-blank'
      })
    }

    return { success: true, questions }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse converted questions'
    return { success: false, error: message }
  }
}

// ============================================
// Lesson Generation Parsers
// ============================================

const VALID_COMPONENT_TYPES: LessonComponentType[] = [
  'bellringer', 'objective', 'direct', 'guided', 'independent',
  'collaborative', 'check', 'closure', 'extension'
]

/**
 * Parse learning goals from LLM response
 */
export function parseLessonGoals(
  content: string,
  _usage: LLMUsage
): ParsedLessonGoalsResult {
  try {
    // Try to extract JSON object from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, error: 'No JSON object found in response' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    // Parse goals
    if (!Array.isArray(parsed.goals)) {
      return { success: false, error: 'Response missing goals array' }
    }

    const goals: LearningGoal[] = []
    for (let i = 0; i < parsed.goals.length; i++) {
      const g = parsed.goals[i] as Record<string, unknown>

      if (typeof g.text !== 'string' || !g.text.trim()) {
        continue
      }

      goals.push({
        id: typeof g.id === 'string' ? g.id : `goal-${Date.now().toString(36)}-${i}`,
        text: g.text.trim(),
        standardRef: typeof g.standardRef === 'string' ? g.standardRef : undefined,
        assessedBy: Array.isArray(g.assessedBy) ? g.assessedBy.filter((x): x is string => typeof x === 'string') : undefined
      })
    }

    if (goals.length === 0) {
      return { success: false, error: 'No valid goals found in response' }
    }

    // Parse success criteria
    const successCriteria: string[] = []
    if (Array.isArray(parsed.successCriteria)) {
      for (const criterion of parsed.successCriteria) {
        if (typeof criterion === 'string' && criterion.trim()) {
          successCriteria.push(criterion.trim())
        }
      }
    }

    return {
      success: true,
      goals,
      successCriteria
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse learning goals'
    return { success: false, error: message }
  }
}

/**
 * Parse lesson structure (components) from LLM response
 */
export function parseLessonStructure(
  content: string,
  _usage: LLMUsage
): ParsedLessonStructureResult {
  try {
    // Try to extract JSON object from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, error: 'No JSON object found in response' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    // Parse components
    if (!Array.isArray(parsed.components)) {
      return { success: false, error: 'Response missing components array' }
    }

    const components: LessonComponent[] = []
    for (let i = 0; i < parsed.components.length; i++) {
      const c = parsed.components[i] as Record<string, unknown>

      // Validate type
      const rawType = typeof c.type === 'string' ? c.type : 'direct'
      const type: LessonComponentType = VALID_COMPONENT_TYPES.includes(rawType as LessonComponentType)
        ? (rawType as LessonComponentType)
        : 'direct'

      // Validate required fields
      const title = typeof c.title === 'string' && c.title.trim() ? c.title.trim() : type
      const description = typeof c.description === 'string' ? c.description.trim() : ''
      const estimatedMinutes = typeof c.estimatedMinutes === 'number' && c.estimatedMinutes > 0
        ? c.estimatedMinutes
        : 5

      components.push({
        id: typeof c.id === 'string' ? c.id : `comp-${Date.now().toString(36)}-${i}`,
        type,
        title,
        description,
        estimatedMinutes,
        order: typeof c.order === 'number' ? c.order : i,
        teacherNotes: typeof c.teacherNotes === 'string' ? c.teacherNotes : undefined,
        studentInstructions: typeof c.studentInstructions === 'string' ? c.studentInstructions : undefined,
        materials: Array.isArray(c.materials) ? c.materials.filter((m): m is string => typeof m === 'string') : undefined,
        assessmentQuestions: Array.isArray(c.assessmentQuestions) ? c.assessmentQuestions.filter((q): q is string => typeof q === 'string') : undefined
      })
    }

    if (components.length === 0) {
      return { success: false, error: 'No valid components found in response' }
    }

    // Sort by order
    components.sort((a, b) => a.order - b.order)

    // Calculate total minutes
    const totalMinutes = typeof parsed.totalMinutes === 'number'
      ? parsed.totalMinutes
      : components.reduce((sum, c) => sum + c.estimatedMinutes, 0)

    return {
      success: true,
      components,
      totalMinutes
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse lesson structure'
    return { success: false, error: message }
  }
}

/**
 * Parse expanded component from LLM response
 */
export function parseExpandedComponent(
  content: string,
  originalComponent: LessonComponent,
  _usage: LLMUsage
): ParsedComponentExpansionResult {
  try {
    // Try to extract JSON object from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, error: 'No JSON object found in response' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    // Build expanded component, keeping original values for missing fields
    const expandedComponent: Partial<LessonComponent> & {
      differentiation?: { support: string; extension: string }
      discussionQuestions?: string[]
      misconceptions?: string[]
      transitionCue?: string
    } = {
      id: originalComponent.id,
      type: originalComponent.type,
      order: originalComponent.order,
      title: typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : originalComponent.title,
      description: typeof parsed.description === 'string'
        ? parsed.description.trim()
        : originalComponent.description,
      estimatedMinutes: typeof parsed.estimatedMinutes === 'number'
        ? parsed.estimatedMinutes
        : originalComponent.estimatedMinutes,
      teacherNotes: typeof parsed.teacherNotes === 'string'
        ? parsed.teacherNotes
        : originalComponent.teacherNotes,
      studentInstructions: typeof parsed.studentInstructions === 'string'
        ? parsed.studentInstructions
        : originalComponent.studentInstructions,
      materials: Array.isArray(parsed.materials)
        ? parsed.materials.filter((m): m is string => typeof m === 'string')
        : originalComponent.materials
    }

    // Parse additional expansion fields
    if (parsed.differentiation && typeof parsed.differentiation === 'object') {
      const diff = parsed.differentiation as Record<string, unknown>
      expandedComponent.differentiation = {
        support: typeof diff.support === 'string' ? diff.support : '',
        extension: typeof diff.extension === 'string' ? diff.extension : ''
      }
    }

    if (Array.isArray(parsed.discussionQuestions)) {
      expandedComponent.discussionQuestions = parsed.discussionQuestions.filter(
        (q): q is string => typeof q === 'string'
      )
    }

    if (Array.isArray(parsed.misconceptions)) {
      expandedComponent.misconceptions = parsed.misconceptions.filter(
        (m): m is string => typeof m === 'string'
      )
    }

    if (typeof parsed.transitionCue === 'string') {
      expandedComponent.transitionCue = parsed.transitionCue
    }

    return {
      success: true,
      component: expandedComponent
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse expanded component'
    return { success: false, error: message }
  }
}

// ============================================
// Material Generation Parser Interfaces
// ============================================

export interface ParsedWorksheetResult {
  success: boolean
  title?: string
  instructions?: string
  questions?: PracticeQuestion[]
  answerKey?: string[]
  error?: string
}

export interface ParsedVocabularyListResult {
  success: boolean
  title?: string
  vocabulary?: VocabularyItem[]
  error?: string
}

export interface ParsedPuzzleVocabularyResult {
  success: boolean
  vocabulary?: PuzzleVocabulary[]
  error?: string
}

export interface ParsedGraphicOrganizerResult {
  success: boolean
  data?: GraphicOrganizerData
  error?: string
}

export interface ParsedExitTicketResult {
  success: boolean
  data?: ExitTicketData
  error?: string
}

// ============================================
// Material Generation Parsers
// ============================================

/**
 * Parse worksheet content from LLM response
 */
export function parseWorksheetContent(
  content: string,
  _usage: LLMUsage
): ParsedWorksheetResult {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, error: 'No JSON object found in response' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    const title = typeof parsed.title === 'string' ? parsed.title : 'Practice Worksheet'
    const instructions = typeof parsed.instructions === 'string' ? parsed.instructions : undefined

    // Parse questions
    const questions: PracticeQuestion[] = []
    if (Array.isArray(parsed.questions)) {
      for (let i = 0; i < parsed.questions.length; i++) {
        const q = parsed.questions[i] as Record<string, unknown>

        if (typeof q.text !== 'string' || !q.text.trim()) {
          continue
        }

        // Determine question type
        let type: PracticeQuestion['type'] = 'short-answer'
        if (typeof q.type === 'string') {
          const typeStr = q.type.toLowerCase()
          if (typeStr.includes('multiple') || typeStr.includes('choice')) {
            type = 'multiple-choice'
          } else if (typeStr.includes('fill') || typeStr.includes('blank')) {
            type = 'fill-blank'
          } else if (typeStr.includes('true') || typeStr.includes('false')) {
            type = 'true-false'
          }
        }

        // Parse choices for multiple choice
        let choices: { id: string; text: string }[] | undefined
        if (type === 'multiple-choice' && Array.isArray(q.choices)) {
          choices = q.choices.map((c: unknown, ci: number) => {
            const choice = c as Record<string, unknown>
            return {
              id: typeof choice.id === 'string' ? choice.id : String.fromCharCode(97 + ci),
              text: String(choice.text ?? '')
            }
          })
        }

        questions.push({
          id: `wq-${Date.now().toString(36)}-${i}`,
          number: typeof q.number === 'number' ? q.number : i + 1,
          text: String(q.text).trim(),
          type,
          choices,
          correctAnswer: typeof q.correctAnswer === 'string' ? q.correctAnswer : '',
          explanation: typeof q.explanation === 'string' ? q.explanation : undefined,
          points: typeof q.points === 'number' ? q.points : 1
        })
      }
    }

    // Parse answer key
    let answerKey: string[] | undefined
    if (Array.isArray(parsed.answerKey)) {
      answerKey = parsed.answerKey.filter((a): a is string => typeof a === 'string')
    }

    return {
      success: true,
      title,
      instructions,
      questions,
      answerKey
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse worksheet content'
    return { success: false, error: message }
  }
}

/**
 * Parse vocabulary list from LLM response
 */
export function parseVocabularyList(
  content: string,
  _usage: LLMUsage
): ParsedVocabularyListResult {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, error: 'No JSON object found in response' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    const title = typeof parsed.title === 'string' ? parsed.title : 'Vocabulary List'

    // Parse vocabulary items
    const vocabulary: VocabularyItem[] = []
    if (Array.isArray(parsed.vocabulary)) {
      for (let i = 0; i < parsed.vocabulary.length; i++) {
        const v = parsed.vocabulary[i] as Record<string, unknown>

        if (typeof v.term !== 'string' || !v.term.trim()) {
          continue
        }

        vocabulary.push({
          id: `vocab-${Date.now().toString(36)}-${i}`,
          term: String(v.term).trim(),
          definition: typeof v.definition === 'string' ? v.definition : '',
          example: typeof v.example === 'string' ? v.example : undefined,
          partOfSpeech: typeof v.partOfSpeech === 'string' ? v.partOfSpeech : undefined
        })
      }
    }

    return {
      success: true,
      title,
      vocabulary
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse vocabulary list'
    return { success: false, error: message }
  }
}

/**
 * Parse puzzle vocabulary from LLM response
 */
export function parsePuzzleVocabulary(
  content: string,
  _usage: LLMUsage
): ParsedPuzzleVocabularyResult {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, error: 'No JSON object found in response' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    const vocabulary: PuzzleVocabulary[] = []
    if (Array.isArray(parsed.vocabulary)) {
      for (const v of parsed.vocabulary) {
        const item = v as Record<string, unknown>

        if (typeof item.word !== 'string' || !item.word.trim()) {
          continue
        }

        // Clean word: uppercase, remove spaces
        const word = String(item.word).toUpperCase().replace(/\s+/g, '')

        // Validate word length for puzzles
        if (word.length < 3 || word.length > 15) {
          continue
        }

        // Determine difficulty
        let difficulty: PuzzleVocabulary['difficulty'] = 'medium'
        if (typeof item.difficulty === 'string') {
          const diff = item.difficulty.toLowerCase()
          if (diff === 'easy') difficulty = 'easy'
          else if (diff === 'hard') difficulty = 'hard'
        }

        vocabulary.push({
          word,
          clue: typeof item.clue === 'string' ? item.clue : `Definition of ${word.toLowerCase()}`,
          difficulty
        })
      }
    }

    return {
      success: true,
      vocabulary
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse puzzle vocabulary'
    return { success: false, error: message }
  }
}

const VALID_GRAPHIC_ORGANIZER_TEMPLATES: GraphicOrganizerTemplate[] = [
  'venn-diagram', 'concept-map', 'flowchart', 'kwl-chart',
  'cause-effect', 'timeline', 'main-idea', 'comparison-matrix'
]

/**
 * Parse graphic organizer content from LLM response
 */
export function parseGraphicOrganizer(
  content: string,
  _usage: LLMUsage
): ParsedGraphicOrganizerResult {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, error: 'No JSON object found in response' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    // Validate template
    const rawTemplate = typeof parsed.template === 'string' ? parsed.template : 'concept-map'
    const template: GraphicOrganizerTemplate = VALID_GRAPHIC_ORGANIZER_TEMPLATES.includes(
      rawTemplate as GraphicOrganizerTemplate
    )
      ? (rawTemplate as GraphicOrganizerTemplate)
      : 'concept-map'

    const title = typeof parsed.title === 'string' ? parsed.title : 'Graphic Organizer'

    // Parse items
    const items: GraphicOrganizerData['items'] = []
    if (Array.isArray(parsed.items)) {
      for (let i = 0; i < parsed.items.length; i++) {
        const item = parsed.items[i] as Record<string, unknown>

        const label = typeof item.label === 'string' ? item.label : `Item ${i + 1}`
        const itemContent: string[] = []

        if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (typeof c === 'string' && c.trim()) {
              itemContent.push(c.trim())
            }
          }
        }

        items.push({
          id: typeof item.id === 'string' ? item.id : `item-${i}`,
          label,
          content: itemContent
        })
      }
    }

    // Parse connections
    const connections: GraphicOrganizerData['connections'] = []
    if (Array.isArray(parsed.connections)) {
      for (const conn of parsed.connections) {
        const c = conn as Record<string, unknown>
        if (typeof c.from === 'string' && typeof c.to === 'string') {
          connections.push({
            from: c.from,
            to: c.to,
            label: typeof c.label === 'string' ? c.label : undefined
          })
        }
      }
    }

    return {
      success: true,
      data: {
        template,
        title,
        items,
        connections
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse graphic organizer'
    return { success: false, error: message }
  }
}

/**
 * Parse exit ticket from LLM response
 */
export function parseExitTicket(
  content: string,
  _usage: LLMUsage
): ParsedExitTicketResult {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, error: 'No JSON object found in response' }
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>

    const title = typeof parsed.title === 'string' ? parsed.title : 'Exit Ticket'

    // Parse questions
    const questions: ExitTicketData['questions'] = []
    if (Array.isArray(parsed.questions)) {
      for (let i = 0; i < parsed.questions.length; i++) {
        const q = parsed.questions[i] as Record<string, unknown>

        if (typeof q.text !== 'string' || !q.text.trim()) {
          continue
        }

        // Determine type
        let type: 'reflection' | 'check' | 'application' = 'check'
        if (typeof q.type === 'string') {
          const typeStr = q.type.toLowerCase()
          if (typeStr.includes('reflection')) type = 'reflection'
          else if (typeStr.includes('application')) type = 'application'
        }

        questions.push({
          id: `exit-${Date.now().toString(36)}-${i}`,
          number: typeof q.number === 'number' ? q.number : i + 1,
          text: String(q.text).trim(),
          type,
          lines: typeof q.lines === 'number' ? q.lines : 2
        })
      }
    }

    return {
      success: true,
      data: {
        title,
        questions
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse exit ticket'
    return { success: false, error: message }
  }
}
