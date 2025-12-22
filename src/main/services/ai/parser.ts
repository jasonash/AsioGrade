/**
 * AI Response Parser
 *
 * Parse and validate LLM outputs for questions and refinements.
 */

import type { GeneratedQuestion, ExtractedQuestion, MaterialImportResult, VariantType } from '../../../shared/types/ai.types'
import type { MultipleChoiceQuestion, Choice } from '../../../shared/types/question.types'
import type { LLMUsage } from '../../../shared/types/llm.types'

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
