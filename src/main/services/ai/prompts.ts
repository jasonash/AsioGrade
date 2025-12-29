/**
 * AI Prompt Templates for Assessment Generation
 *
 * Contains system prompts and builders for question generation,
 * refinement, and conversational assistance.
 */

import type {
  QuestionGenerationRequest,
  RefinementCommand,
  MaterialImportRequest,
  VariantGenerationRequest,
  FillInBlankConversionRequest,
  DOKVariantGenerationRequest
} from '../../../shared/types/ai.types'
import type { MultipleChoiceQuestion } from '../../../shared/types/question.types'
import type { Assessment } from '../../../shared/types/assessment.types'
import type { DOKLevel } from '../../../shared/types/roster.types'

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
For other requests, respond conversationally with helpful suggestions.`,

  materialImport: `You are an expert at extracting assessment questions from educational documents. Your task is to identify any quiz, test, or assessment questions in the provided text and structure them into a standard format.

You should:
1. Identify questions even if they're embedded in other content
2. Recognize multiple choice, true/false, fill-in-the-blank, and short answer formats
3. For FILL-IN-THE-BLANK questions:
   - Mark them as type "fill_in_blank"
   - Set "correctAnswer" to the word or phrase that goes in the blank
   - Use your subject knowledge to determine the correct answer
   - Include the blank indicator (___) in the question text
4. Extract answer choices when present for multiple choice
5. Note if the correct answer is indicated
6. Assess your confidence in each extraction

If the document contains study material rather than explicit questions, note this and suggest how the content could be converted to questions.`,

  variantGeneration: `You are an expert in educational assessment and Universal Design for Learning (UDL). Your task is to create alternative versions of questions that maintain the same learning objective while adjusting for different student needs.`,

  fillInBlankConversion: `You are an expert educational assessment developer. Your task is to convert fill-in-the-blank questions into multiple choice format by generating plausible distractors (incorrect answers).

GUIDELINES FOR DISTRACTORS:
- Base distractors on common student misconceptions
- Use similar vocabulary and phrasing as the correct answer
- Ensure distractors are clearly wrong to someone who understands the concept
- Make all choices the same approximate length
- Avoid "trick" answers that are only wrong due to technicalities
- Consider what incorrect but related concepts students might confuse`,

  dokVariantGeneration: `You are an expert in educational assessment design and Webb's Depth of Knowledge (DOK) framework.

Your task is to create assessment variants that adjust question difficulty while maintaining alignment to learning standards.

WEBB'S DOK FRAMEWORK:
- DOK 1 (Recall): Basic recall of facts, terms, definitions, simple procedures
- DOK 2 (Skill/Concept): Use of information, concepts, skills in new situations, some reasoning required
- DOK 3 (Strategic Thinking): Complex reasoning, planning, synthesis, analyzing multiple sources
- DOK 4 (Extended Thinking): Complex reasoning over extended time, designing investigations, making connections

GUIDELINES FOR VARIANT GENERATION:
- When targeting lower DOK: Simplify vocabulary, reduce complexity, focus on key concepts, make distractors more obviously wrong
- When targeting higher DOK: Add analytical depth, require synthesis, increase cognitive demand, make distractors more nuanced
- Always maintain alignment to the same learning standards
- Keep question format consistent (multiple choice with 4 options)
- Ensure distractors reflect DOK level appropriateness
- Provide clear explanations for why the correct answer is correct`
}

/**
 * Build the user prompt for question generation
 * @param request - The question generation request
 * @param standardsText - The formatted standards text
 * @param materialContext - Optional extracted text from course materials
 */
export function buildQuestionGenerationPrompt(
  request: QuestionGenerationRequest,
  standardsText: string,
  materialContext?: string
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

  // Build material context section if materials provided
  const materialSection = materialContext
    ? `\nCOURSE MATERIALS (use as source content for questions):
${materialContext}

IMPORTANT: Base questions on the content from the course materials above when applicable.
Questions should assess understanding of the material while aligning to the standards.\n`
    : ''

  // Build custom prompt section if provided
  const customPromptSection = request.customPrompt?.trim()
    ? `\nTEACHER INSTRUCTIONS:
${request.customPrompt.trim()}\n`
    : ''

  return `Generate ${request.questionCount} multiple choice questions for grade ${request.gradeLevel} ${request.subject}.

STANDARDS TO ASSESS:
${standardsText}
${materialSection}${customPromptSection}
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

/**
 * Build the prompt for extracting questions from imported material
 */
export function buildMaterialImportPrompt(request: MaterialImportRequest): string {
  const countHint = request.expectedQuestionCount
    ? `\nExpected question count: approximately ${request.expectedQuestionCount}`
    : ''

  return `Analyze this ${request.subject} document for grade ${request.gradeLevel} students and extract any assessment questions.
${countHint}

SOURCE FILE: ${request.sourceFileName}

DOCUMENT CONTENT:
${request.text}

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "questions": [
    {
      "text": "The question text (keep blanks as ___ for fill-in-blank)",
      "type": "multiple_choice" | "true_false" | "fill_in_blank" | "short_answer" | "unknown",
      "choices": [
        { "id": "a", "text": "Choice text", "isCorrect": true/false }
      ],
      "correctAnswer": "a" (for MC) or "the answer word/phrase" (for fill_in_blank),
      "confidence": "high" | "medium" | "low",
      "notes": "Any notes about this extraction"
    }
  ],
  "summary": "Brief summary of what was found",
  "nonQuestionContent": "Summary of any useful content that wasn't questions"
}

GUIDELINES:
- Include ALL questions you find, even if you're unsure about format
- For FILL-IN-THE-BLANK questions:
  * Set type to "fill_in_blank"
  * Set "correctAnswer" to the word/phrase that belongs in the blank
  * Use your subject matter knowledge to determine the correct answer
  * Keep the blank indicator (___) in the question text
- For multiple choice, always include 4 choices (a, b, c, d) when possible
- Mark confidence as "high" if the question and answer are clear
- Mark confidence as "medium" if you had to infer something
- Mark confidence as "low" if you're uncertain about the format or answer
- If correct answers aren't marked, set isCorrect to false for all and note this
- Extract question text exactly as written, only fix obvious typos

Extract the questions now:`
}

/**
 * Build the prompt for generating question variants
 */
export function buildVariantPrompt(request: VariantGenerationRequest): string {
  const questionJson = JSON.stringify(
    {
      text: request.question.text,
      choices: request.question.choices,
      correctAnswer: request.question.correctAnswer,
      standardRef: request.question.standardRef
    },
    null,
    2
  )

  const variantPrompts: Record<typeof request.variantType, string> = {
    simplified: `Create a SIMPLIFIED version of this question for students who need reading support.

Guidelines:
- Lower the reading level to approximately ${request.targetReadingLevel ?? 'elementary level'}
- Use shorter sentences and simpler vocabulary
- Keep the same concept being tested
- Maintain the same correct answer
- Simplify distractors without making them too obvious
- The question should still be valid assessment`,

    scaffolded: `Create a SCAFFOLDED version of this question with built-in support.

Guidelines:
- Add ${request.hintsToAdd ?? 1} hint(s) within the question stem
- Hints should guide thinking without revealing the answer
- Consider adding:
  - Definition reminders
  - Process hints ("First, consider...")
  - Visual cues if applicable
  - Reference to related concepts
- Keep the same correct answer
- The question should still assess the same standard`,

    extended: `Create an EXTENDED version of this question for students who need more challenge.

Guidelines:
- Increase complexity through:
  - Multi-step reasoning
  - Application to new contexts
  - Synthesis of multiple concepts
  - More nuanced distractors
${request.additionalComplexity ? `- Additional focus: ${request.additionalComplexity}` : ''}
- The question should still align to the same standard
- Keep it challenging but fair`
  }

  return `${variantPrompts[request.variantType]}

ORIGINAL QUESTION:
${questionJson}

TARGET GRADE LEVEL: ${request.gradeLevel}

OUTPUT FORMAT:
Return a JSON object with:
{
  "text": "The modified question text",
  "choices": [
    { "id": "a", "text": "Choice text", "isCorrect": false },
    { "id": "b", "text": "Choice text", "isCorrect": true },
    { "id": "c", "text": "Choice text", "isCorrect": false },
    { "id": "d", "text": "Choice text", "isCorrect": false }
  ],
  "correctAnswer": "b",
  "explanation": "Description of what was changed and why"
}

Generate the ${request.variantType} variant now:`
}

/**
 * Build the prompt for converting fill-in-the-blank questions to multiple choice
 */
export function buildFillInBlankConversionPrompt(request: FillInBlankConversionRequest): string {
  const questionsJson = request.questions.map((q) => ({
    id: q.id,
    text: q.text,
    correctAnswer: q.correctAnswer
  }))

  return `Convert these fill-in-the-blank questions to multiple choice format for grade ${request.gradeLevel} ${request.subject} students.

QUESTIONS TO CONVERT:
${JSON.stringify(questionsJson, null, 2)}

REQUIREMENTS:
1. Keep the question text the same (including the blank indicator ___)
2. Create 4 answer choices (a, b, c, d) where ONE is correct
3. The correct answer choice should contain the original "correctAnswer" value
4. Generate 3 PLAUSIBLE but INCORRECT distractors that:
   - Are related to the subject matter
   - Represent common student misconceptions
   - Are similar in length and format to the correct answer
   - Are clearly wrong to someone who understands the concept
5. Randomize which choice (a, b, c, or d) is correct

OUTPUT FORMAT:
Return a JSON array of converted questions:
[
  {
    "id": "original-question-id",
    "text": "Original question text with ___",
    "type": "multiple_choice",
    "choices": [
      { "id": "a", "text": "Choice text", "isCorrect": false },
      { "id": "b", "text": "Correct answer", "isCorrect": true },
      { "id": "c", "text": "Choice text", "isCorrect": false },
      { "id": "d", "text": "Choice text", "isCorrect": false }
    ],
    "correctAnswer": "b",
    "confidence": "high"
  }
]

Convert all ${request.questions.length} questions now:`
}

/**
 * DOK level descriptions for prompts
 */
const DOK_DESCRIPTIONS: Record<DOKLevel, string> = {
  1: 'Recall - Basic recall of facts, terms, definitions, simple procedures',
  2: 'Skill/Concept - Use of information, concepts, skills with some reasoning',
  3: 'Strategic Thinking - Complex reasoning, planning, synthesis, using evidence',
  4: 'Extended Thinking - Complex reasoning over time, designing investigations'
}

/**
 * Build the prompt for generating DOK-based assessment variants
 */
export function buildDOKVariantPrompt(
  request: DOKVariantGenerationRequest,
  assessment: Assessment,
  standardsText: string
): string {
  const questionsJson = assessment.questions.map((q, i) => ({
    index: i + 1,
    id: q.id,
    text: q.text,
    choices: q.choices,
    correctAnswer: q.correctAnswer,
    standardRef: q.standardRef
  }))

  // Different instructions based on strategy
  const strategyInstructions =
    request.strategy === 'questions'
      ? `Generate ${assessment.questions.length} NEW questions that:
- Test the SAME standards as the original assessment
- Target DOK Level ${request.targetDOK}: ${DOK_DESCRIPTIONS[request.targetDOK]}
- Maintain similar point values
- Are appropriate for the target DOK level
- Include clear explanations for each answer

For DOK ${request.targetDOK}:
${request.targetDOK === 1 ? '- Focus on recall of facts, definitions, and simple procedures\n- Use direct, straightforward question stems\n- Make distractors obviously different from the correct answer' : ''}${request.targetDOK === 2 ? '- Require application of concepts or skills\n- Include some inference or comparison\n- Make distractors based on procedural errors' : ''}${request.targetDOK === 3 ? '- Require analysis, reasoning, or evidence evaluation\n- May involve multiple steps or considerations\n- Make distractors represent sophisticated but incorrect reasoning' : ''}${request.targetDOK === 4 ? '- Require synthesis, evaluation, or complex reasoning\n- Connect multiple concepts or contexts\n- Make distractors represent advanced but flawed thinking' : ''}`
      : `Update the DISTRACTORS (wrong answer choices) for each question to better target DOK Level ${request.targetDOK}.

KEEP UNCHANGED:
- Question stems (the question text)
- Correct answers
- Standard alignment

MODIFY:
- All three distractors for each question

For DOK ${request.targetDOK} distractors:
${request.targetDOK === 1 ? '- Make distractors more obviously wrong\n- Use clearly different terms or concepts\n- Avoid subtle distinctions that require deep understanding' : ''}${request.targetDOK === 2 ? '- Base distractors on common procedural mistakes\n- Include answers that would result from skipping steps\n- Use related but clearly incorrect terms' : ''}${request.targetDOK === 3 ? '- Make distractors represent plausible but incomplete reasoning\n- Include partially correct answers\n- Require careful analysis to distinguish from correct answer' : ''}${request.targetDOK === 4 ? '- Make distractors represent sophisticated misconceptions\n- Include answers that would be correct in different contexts\n- Require synthesis of multiple concepts to eliminate' : ''}`

  const outputFormat =
    request.strategy === 'questions'
      ? `Return ONLY a valid JSON array of ${assessment.questions.length} questions:
[
  {
    "text": "Question stem",
    "choices": [
      { "id": "a", "text": "Choice A", "isCorrect": false },
      { "id": "b", "text": "Choice B", "isCorrect": true },
      { "id": "c", "text": "Choice C", "isCorrect": false },
      { "id": "d", "text": "Choice D", "isCorrect": false }
    ],
    "correctAnswer": "b",
    "standardRef": "STANDARD-CODE",
    "explanation": "Why this is the correct answer"
  }
]`
      : `Return ONLY a valid JSON object with updated questions:
{
  "questions": [
    {
      "id": "original-question-id",
      "choices": [
        { "id": "a", "text": "New choice A", "isCorrect": false },
        { "id": "b", "text": "Correct answer (unchanged)", "isCorrect": true },
        { "id": "c", "text": "New choice C", "isCorrect": false },
        { "id": "d", "text": "New choice D", "isCorrect": false }
      ]
    }
  ]
}`

  return `Create a DOK Level ${request.targetDOK} variant of this assessment for grade ${request.gradeLevel} ${request.subject}.

ORIGINAL ASSESSMENT: "${assessment.title}"
Question Count: ${assessment.questions.length}
Strategy: ${request.strategy === 'questions' ? 'Generate new questions' : 'Update distractors only'}

ORIGINAL QUESTIONS:
${JSON.stringify(questionsJson, null, 2)}

STANDARDS TO MAINTAIN:
${standardsText}

TASK:
${strategyInstructions}

OUTPUT FORMAT:
${outputFormat}

Generate the DOK ${request.targetDOK} variant now:`
}
