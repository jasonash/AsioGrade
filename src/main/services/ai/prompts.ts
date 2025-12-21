/**
 * AI Prompt Templates for Assessment Generation
 *
 * Contains system prompts and builders for question generation,
 * refinement, and conversational assistance.
 */

import type { QuestionGenerationRequest, RefinementCommand } from '../../../shared/types/ai.types'
import type { MultipleChoiceQuestion } from '../../../shared/types/question.types'

/**
 * System prompts for different AI operations
 */
export const SYSTEM_PROMPTS = {
  questionGeneration: `You are an expert educational assessment developer. Your task is to create high-quality assessment questions that:
1. Align directly to the provided learning standards
2. Use age-appropriate vocabulary and reading level
3. Test understanding, not just recall
4. Have plausible distractors based on common misconceptions
5. Are clear, unambiguous, and free from bias

GUIDELINES:
- Distribute questions evenly across standards when possible
- Vary question complexity within the difficulty level
- Avoid "all of the above" or "none of the above"
- Make distractors plausible but clearly incorrect to someone who understands the concept
- Avoid negative phrasing ("Which is NOT...")
- Keep question stems concise but complete`,

  questionRefinement: `You are an expert educational assessment specialist helping teachers improve their assessment questions. You provide specific, actionable improvements while maintaining the original learning objective.`,

  conversationalAssistant: `You are an AI teaching assistant helping a teacher create and refine assessment questions. You are helpful, professional, and focused on educational best practices. You understand curriculum standards and can generate or improve questions on request.

When asked to generate questions, respond with a JSON array of questions.
When asked to refine a question, respond with the refined question in JSON format.
For other requests, respond conversationally with helpful suggestions.`
}

/**
 * Build the user prompt for question generation
 */
export function buildQuestionGenerationPrompt(
  request: QuestionGenerationRequest,
  standardsText: string
): string {
  const difficultyNote = request.difficulty === 'mixed'
    ? 'Include a mix of easy, medium, and hard questions'
    : `Target difficulty: ${request.difficulty}`

  const focusNote = request.focusTopics?.length
    ? `\n- Focus on these topics: ${request.focusTopics.join(', ')}`
    : ''

  const avoidNote = request.avoidTopics?.length
    ? `\n- Avoid these topics: ${request.avoidTopics.join(', ')}`
    : ''

  return `Generate ${request.questionCount} multiple choice questions for grade ${request.gradeLevel} ${request.subject}.

STANDARDS TO ASSESS:
${standardsText}

REQUIREMENTS:
- Question types: ${request.questionTypes.join(', ')}
- ${difficultyNote}${focusNote}${avoidNote}

OUTPUT FORMAT:
Return ONLY a valid JSON array with no additional text. Each question object must have:
{
  "text": "The question stem",
  "choices": [
    { "id": "a", "text": "First choice", "isCorrect": false },
    { "id": "b", "text": "Second choice", "isCorrect": true },
    { "id": "c", "text": "Third choice", "isCorrect": false },
    { "id": "d", "text": "Fourth choice", "isCorrect": false }
  ],
  "correctAnswer": "b",
  "standardRef": "STANDARD-CODE",
  "explanation": "Brief explanation of why this answer is correct"
}

Generate exactly ${request.questionCount} questions now:`
}

/**
 * Build the user prompt for question refinement
 */
export function buildRefinementPrompt(
  question: MultipleChoiceQuestion,
  command: RefinementCommand,
  gradeLevel: string,
  standardRef?: string
): string {
  const questionJson = JSON.stringify(
    {
      text: question.text,
      choices: question.choices,
      correctAnswer: question.correctAnswer,
      standardRef: question.standardRef
    },
    null,
    2
  )

  const commandPrompts: Record<RefinementCommand, string> = {
    simplify: `Rewrite this question for a lower reading level while maintaining the same concept being assessed.
Keep the cognitive demand similar but use simpler vocabulary and shorter sentences.
Target grade level: ${gradeLevel}`,

    harder: `Increase the difficulty of this question. You can:
- Add complexity to the stem
- Require deeper analysis
- Make distractors more subtle
- Require synthesis of concepts
Maintain alignment to standard: ${standardRef ?? 'as provided'}`,

    distractors: `Improve the distractors (wrong answers) for this question. Good distractors should:
1. Be plausible to students who have misconceptions
2. Be clearly wrong to students who understand the concept
3. Be similar in length and structure to the correct answer
4. Not be obviously wrong or silly
Keep the correct answer unchanged.`,

    rephrase: `Rephrase this question to test the same concept in a different way.
Keep the same difficulty level and standard alignment.
Change the wording significantly while maintaining the same learning objective.
The question should feel fresh, not just a minor word substitution.`,

    hint: `Add a subtle hint to this question to scaffold struggling students.
The hint should guide thinking without giving away the answer.
Add it naturally to the question stem, such as:
- A reminder of a relevant concept
- A clarifying context
- A gentle nudge toward the reasoning needed`,

    explain: `Provide a detailed explanation of:
1. Why the correct answer is correct
2. Why each distractor is incorrect
3. Common misconceptions this question tests
Return the same question with an expanded "explanation" field.`
  }

  return `${commandPrompts[command]}

Current question:
${questionJson}

Return the improved question in the same JSON format. Include an "explanation" field describing what you changed and why.`
}

/**
 * Build the context prompt for conversational chat
 */
export function buildChatContextPrompt(
  assessmentTitle: string,
  subject: string,
  gradeLevel: string,
  standardRefs: string[],
  existingQuestionCount: number
): string {
  return `Current context:
- Assessment: "${assessmentTitle}"
- Course: ${subject} (Grade ${gradeLevel})
- Standards: ${standardRefs.length > 0 ? standardRefs.join(', ') : 'None selected'}
- Existing questions: ${existingQuestionCount}

When generating questions, use the JSON format specified in your instructions.
When refining questions, maintain the JSON format with an explanation of changes.`
}
