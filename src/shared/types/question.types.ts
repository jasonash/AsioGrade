/**
 * Question type definitions for assessments
 *
 * Currently supports: multiple_choice
 * Future: true_false, matching, numeric_fill_in
 */

// Question types - start with multiple choice only
export type QuestionType = 'multiple_choice'
// Future expansion:
// export type QuestionType = 'multiple_choice' | 'true_false' | 'matching' | 'numeric_fill_in'

/**
 * Base question interface - common fields for all question types
 */
export interface BaseQuestion {
  id: string
  type: QuestionType
  text: string
  standardRef?: string // Aligned to standard code (e.g., "MS-ESS2-1")
  points: number
  createdAt: string
  // Future: dok?: 1 | 2 | 3 | 4  // Depth of Knowledge level

  // AI generation tracking (optional)
  aiGenerated?: boolean
  aiModel?: string
  aiGeneratedAt?: string
  explanation?: string // Why the answer is correct
}

/**
 * Choice for multiple choice questions
 */
export interface Choice {
  id: string // 'a', 'b', 'c', 'd', etc.
  text: string
  isCorrect: boolean
}

/**
 * Multiple choice question
 */
export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple_choice'
  choices: Choice[]
  correctAnswer: string // The id of the correct choice ('a', 'b', 'c', or 'd')
}

// Union type for all question types (currently just MC)
export type Question = MultipleChoiceQuestion
// Future expansion:
// export type Question = MultipleChoiceQuestion | TrueFalseQuestion | MatchingQuestion | NumericFillInQuestion

/**
 * Input type for creating a new question
 */
export interface CreateQuestionInput {
  type: QuestionType
  text: string
  standardRef?: string
  points?: number // Defaults to 1
  choices?: Choice[] // Required for multiple choice
}

/**
 * Input type for updating a question
 */
export interface UpdateQuestionInput {
  id: string
  text?: string
  standardRef?: string
  points?: number
  choices?: Choice[]
  correctAnswer?: string
}
