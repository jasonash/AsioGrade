/**
 * Randomization Service
 *
 * Handles generation of randomized assessment versions (A/B/C/D)
 * with shuffled question order and choice order within questions.
 */

import type {
  Assessment,
  AssessmentVersion,
  VersionId,
  VersionAnswerKeyEntry,
  Question
} from '../../shared/types'

// All version IDs
const VERSION_IDS: VersionId[] = ['A', 'B', 'C', 'D']

// Letter mapping for answer key display
const CHOICE_LETTERS = ['A', 'B', 'C', 'D']

/**
 * Fisher-Yates shuffle algorithm
 * Creates a new shuffled array (does not mutate original)
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Generate a single randomized version of the assessment
 */
function generateSingleVersion(
  questions: Question[],
  versionId: VersionId
): AssessmentVersion {
  // Shuffle question order
  const questionOrder = shuffle(questions.map((q) => q.id))

  // Shuffle choices for each question
  const choiceOrders: Record<string, string[]> = {}
  for (const question of questions) {
    if (question.type === 'multiple_choice' && question.choices) {
      choiceOrders[question.id] = shuffle(question.choices.map((c) => c.id))
    }
  }

  return {
    versionId,
    questionOrder,
    choiceOrders
  }
}

/**
 * Generate all 4 randomized versions (A, B, C, D) for an assessment
 */
export function generateVersions(assessment: Assessment): AssessmentVersion[] {
  if (!assessment.questions || assessment.questions.length === 0) {
    throw new Error('Cannot generate versions for assessment with no questions')
  }

  return VERSION_IDS.map((versionId) =>
    generateSingleVersion(assessment.questions, versionId)
  )
}

/**
 * Generate all 4 randomized versions (A, B, C, D) for a standalone question array
 * Used for generating versions for DOK variants
 */
export function generateVersionsForQuestions(questions: Question[]): AssessmentVersion[] {
  if (!questions || questions.length === 0) {
    throw new Error('Cannot generate versions for empty question list')
  }

  return VERSION_IDS.map((versionId) => generateSingleVersion(questions, versionId))
}

/**
 * Get the answer key for a specific version
 * Returns the correct answer letter for each question in the version's order
 */
export function getAnswerKey(
  assessment: Assessment,
  version: AssessmentVersion
): VersionAnswerKeyEntry[] {
  const answerKey: VersionAnswerKeyEntry[] = []

  // Create a map of question ID to question for quick lookup
  const questionMap = new Map(assessment.questions.map((q) => [q.id, q]))

  // Iterate through questions in version order
  version.questionOrder.forEach((questionId, index) => {
    const question = questionMap.get(questionId)
    if (!question || question.type !== 'multiple_choice') return

    const correctChoiceId = question.correctAnswer
    const choiceOrder = version.choiceOrders[questionId]

    if (!choiceOrder) return

    // Find the position of the correct answer in this version's shuffled order
    const correctPosition = choiceOrder.indexOf(correctChoiceId)
    const correctLetter = correctPosition >= 0 ? CHOICE_LETTERS[correctPosition] : '?'

    answerKey.push({
      questionNumber: index + 1,
      questionId,
      correctChoiceId,
      correctLetter
    })
  })

  return answerKey
}

/**
 * Get answer keys for all versions
 */
export function getAllAnswerKeys(
  assessment: Assessment
): Record<VersionId, VersionAnswerKeyEntry[]> {
  const versions = assessment.versions
  if (!versions || versions.length === 0) {
    throw new Error('Assessment has no versions')
  }

  const result: Partial<Record<VersionId, VersionAnswerKeyEntry[]>> = {}
  for (const version of versions) {
    result[version.versionId] = getAnswerKey(assessment, version)
  }

  return result as Record<VersionId, VersionAnswerKeyEntry[]>
}

/**
 * Get a question in its version-specific order with shuffled choices
 */
export function getVersionedQuestion(
  question: Question,
  version: AssessmentVersion
): Question {
  if (question.type !== 'multiple_choice' || !question.choices) {
    return question
  }

  const choiceOrder = version.choiceOrders[question.id]
  if (!choiceOrder) {
    return question
  }

  // Create a map of choice ID to choice
  const choiceMap = new Map(question.choices.map((c) => [c.id, c]))

  // Reorder choices according to version
  const reorderedChoices = choiceOrder
    .map((id) => choiceMap.get(id))
    .filter((c): c is NonNullable<typeof c> => c !== undefined)

  return {
    ...question,
    choices: reorderedChoices
  }
}

/**
 * Get all questions for a version in the correct order with shuffled choices
 */
export function getVersionedQuestions(
  assessment: Assessment,
  version: AssessmentVersion
): Question[] {
  const questionMap = new Map(assessment.questions.map((q) => [q.id, q]))

  return version.questionOrder
    .map((id) => questionMap.get(id))
    .filter((q): q is Question => q !== undefined)
    .map((q) => getVersionedQuestion(q, version))
}

export const randomizationService = {
  generateVersions,
  generateVersionsForQuestions,
  getAnswerKey,
  getAllAnswerKeys,
  getVersionedQuestion,
  getVersionedQuestions
}
