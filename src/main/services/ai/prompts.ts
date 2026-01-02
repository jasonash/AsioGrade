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
  questionGeneration: `You are an expert educational assessment designer working with secondary teachers (Grades 6–12). Your task is to generate instructionally valid quiz questions that reflect real classroom assessment practices.

INSTRUCTIONAL SCOPE:
- Assess ONLY concepts explicitly named in the provided learning intentions, success criteria, or taught content
- Course materials (textbooks, PDFs) provide context for wording and examples but do NOT expand assessment scope
- If a concept is not explicitly identified as taught content, it must not be assessed
- Rule: if a teacher could reasonably say "I did not teach this," the question is invalid

QUESTION DESIGN:
- Use multiple-choice format with one clearly correct answer
- Distractors must reflect plausible student misconceptions, not advanced or untaught facts
- Avoid trick questions, ambiguous wording, unnecessary reading load, and "all/none of the above"
- Keep question stems concise but complete

STUDENT POPULATION:
- Assume a mixed-ability classroom including English learners, students with IEPs/504s, and students who struggle with reading or abstract reasoning
- Prioritize clarity, fairness, and alignment over cleverness

FINAL VALIDATION:
Before presenting any question, verify:
1. The content was explicitly identified as taught
2. A reasonable student would not feel blindsided
If either condition fails, revise or discard the item.`,

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

CRITICAL PRINCIPLE - THE "IDEA SPINE":
DOK describes the TYPE OF THINKING required, not content complexity. Increasing DOK must NOT introduce new topics, mechanisms, vocabulary, or facts. The core scientific idea (the "idea spine") must remain identical. Only the STUDENT'S COGNITIVE TASK changes.

WEBB'S DOK FRAMEWORK:
- DOK 1 (Recall): Recall or identify taught facts, terms, definitions
- DOK 2 (Skill/Concept): Explain, compare, classify, or interpret using ONE step of reasoning
- DOK 3 (Strategic Thinking): Justify, evaluate evidence, or choose between explanations using ONLY taught content
- DOK 4 (Extended Thinking): Synthesis over extended time - only generate if explicitly requested

VARIANT GENERATION RULES:
- DOK variants must preserve the SAME core idea as the base question
- Variants may change the task or framing but NOT the topic, evidence type, or instructional scope
- If raising the DOK would require introducing new content, do NOT generate that variant
- When targeting lower DOK: Change the task to recall/identify, make distractors more obviously different
- When targeting higher DOK: Change the task to require reasoning/justification about the SAME content

VALIDATION:
Before presenting any variant, verify:
1. The scientific content is identical to the original question
2. Only the cognitive task has changed
3. No new facts, mechanisms, or vocabulary were introduced
If any condition fails, revise or discard the variant.`
}

/**
 * Build the user prompt for question generation
 * @param request - The question generation request
 * @param standardsText - The formatted standards text
 * @param taughtContent - What was explicitly taught (defines assessable scope)
 * @param materialContext - Optional extracted text from course materials (context only, not scope)
 * @param appPromptSupplement - Optional global app-level prompt supplement
 * @param coursePromptSupplement - Optional course-level prompt supplement
 */
export function buildQuestionGenerationPrompt(
  request: QuestionGenerationRequest,
  standardsText: string,
  taughtContent?: string,
  materialContext?: string,
  appPromptSupplement?: string,
  coursePromptSupplement?: string
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

  // Build taught content section - THIS DEFINES WHAT CAN BE ASSESSED
  const taughtContentSection = taughtContent?.trim()
    ? `\nTAUGHT CONTENT (This defines what CAN be assessed - do not assess anything outside this scope):
${taughtContent.trim()}

CRITICAL: Only assess concepts explicitly listed above. If something is not mentioned here, it is NOT assessable, even if it appears in standards or materials.\n`
    : ''

  // Build material context section - for wording/examples only, NOT scope expansion
  const materialSection = materialContext
    ? `\nCOURSE MATERIALS (Use for wording, examples, and distractors - NOT to expand assessment scope):
${materialContext}

NOTE: These materials provide context for HOW to phrase questions and generate realistic distractors. They do NOT expand what can be assessed beyond the taught content above.\n`
    : ''

  // Build instruction sections for each level (app → course → request)
  const instructionSections: string[] = []

  if (appPromptSupplement?.trim()) {
    instructionSections.push(`GLOBAL INSTRUCTIONS (applies to all assessments):
${appPromptSupplement.trim()}`)
  }

  if (coursePromptSupplement?.trim()) {
    instructionSections.push(`COURSE INSTRUCTIONS (applies to this course):
${coursePromptSupplement.trim()}`)
  }

  if (request.customPrompt?.trim()) {
    instructionSections.push(`TEACHER INSTRUCTIONS (for this generation):
${request.customPrompt.trim()}`)
  }

  const instructionsSection = instructionSections.length > 0
    ? `\n${instructionSections.join('\n\n')}\n`
    : ''

  // Scope guidance based on what's provided
  const scopeGuidance = taughtContent?.trim()
    ? 'Assess ONLY the taught content listed above. Standards provide alignment context.'
    : 'Assess concepts from the standards. Keep questions focused and avoid introducing untaught complexity.'

  return `Generate ${request.questionCount} multiple choice questions for grade ${request.gradeLevel} ${request.subject}.

STANDARDS (for alignment):
${standardsText}
${taughtContentSection}${materialSection}${instructionsSection}
SCOPE: ${scopeGuidance}

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
 * DOK level descriptions for prompts - focused on TASK type, not content complexity
 */
const DOK_DESCRIPTIONS: Record<DOKLevel, string> = {
  1: 'Recall - Recall or identify taught facts, terms, definitions',
  2: 'Skill/Concept - Explain, compare, classify using ONE step of reasoning',
  3: 'Strategic Thinking - Justify, evaluate evidence, choose between explanations',
  4: 'Extended Thinking - Synthesis over extended time (only if explicitly requested)'
}

/**
 * DOK-specific task instructions - what the STUDENT must do (not content changes)
 */
const DOK_TASK_INSTRUCTIONS: Record<DOKLevel, string> = {
  1: `For DOK 1 (Recall):
- Ask students to IDENTIFY or RECALL the taught concept directly
- Use simple, direct question stems like "What is...", "Which of these is..."
- The correct answer should be a direct fact from instruction
- Distractors should be clearly different (wrong terms, unrelated concepts)
- No reasoning required - just recognition of taught information`,

  2: `For DOK 2 (Skill/Concept):
- Ask students to EXPLAIN, COMPARE, or CLASSIFY using the taught concept
- Requires ONE step of reasoning or application
- Question might ask "Why does...", "How would you classify...", "What is the difference..."
- Distractors should represent common procedural errors or partial understanding
- Student applies knowledge but doesn't need to synthesize multiple ideas`,

  3: `For DOK 3 (Strategic Thinking):
- Ask students to JUSTIFY, EVALUATE, or CHOOSE between explanations
- Requires reasoning with evidence USING ONLY the taught content
- Question might ask "Which explanation best...", "What evidence supports...", "Why would X occur instead of Y..."
- Distractors should represent plausible but flawed reasoning about the SAME concept
- Student must think strategically but NOT learn new content to answer`,

  4: `For DOK 4 (Extended Thinking):
- Only generate if explicitly requested
- Requires synthesis across multiple taught concepts over time
- Complex but still bounded by what was taught`
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
      ? `Generate ${assessment.questions.length} NEW questions that preserve the "IDEA SPINE" of each original question.

THE IDEA SPINE RULE:
Each new question must test the EXACT SAME scientific concept/fact as the corresponding original question.
You are changing the COGNITIVE TASK the student performs, NOT the content they must know.
If the original asks about water's chemical formula, the variant ALSO asks about water's chemical formula.
DO NOT introduce new facts, mechanisms, vocabulary, or adjacent topics.

Target: DOK Level ${request.targetDOK} - ${DOK_DESCRIPTIONS[request.targetDOK]}

${DOK_TASK_INSTRUCTIONS[request.targetDOK]}

For each question:
1. Identify the core concept being tested (the "idea spine")
2. Rewrite the question to change only the TASK (recall → explain → justify)
3. Ensure distractors match the DOK level
4. Verify NO new content was introduced`
      : `Update the DISTRACTORS for each question to match DOK Level ${request.targetDOK}.

KEEP UNCHANGED:
- Question stems (the question text)
- Correct answers
- The core concept being tested

MODIFY ONLY:
- The three incorrect answer choices (distractors)

${DOK_TASK_INSTRUCTIONS[request.targetDOK]}

Distractor guidelines for DOK ${request.targetDOK}:
${request.targetDOK === 1 ? '- Make distractors obviously different from the correct answer\n- Use unrelated terms or clearly wrong facts\n- A student who learned the content should easily eliminate these' : ''}${request.targetDOK === 2 ? '- Base distractors on common procedural errors\n- Include answers that skip a step or misapply a rule\n- Related to the concept but clearly wrong with one step of reasoning' : ''}${request.targetDOK === 3 ? '- Make distractors represent plausible but incomplete reasoning\n- Include answers that would be correct if a key detail were different\n- Require careful analysis of the SAME concept to eliminate' : ''}${request.targetDOK === 4 ? '- Make distractors represent sophisticated but flawed synthesis\n- Answers that connect ideas incorrectly\n- Still bounded by taught content' : ''}`

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
    "explanation": "Why this is correct AND what idea spine was preserved"
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

CRITICAL RULE - IDEA SPINE PRESERVATION:
DOK changes the TYPE OF THINKING required, NOT the content.
Each variant question must test the SAME core concept as the original.
DO NOT introduce new topics, mechanisms, vocabulary, or facts.
If you cannot create a valid DOK ${request.targetDOK} variant without adding new content, keep the question closer to its original form.

ORIGINAL ASSESSMENT: "${assessment.title}"
Question Count: ${assessment.questions.length}
Strategy: ${request.strategy === 'questions' ? 'Generate new questions (same concepts, different tasks)' : 'Update distractors only'}

ORIGINAL QUESTIONS:
${JSON.stringify(questionsJson, null, 2)}

STANDARDS (for alignment reference):
${standardsText}

TASK:
${strategyInstructions}

OUTPUT FORMAT:
${outputFormat}

VALIDATION BEFORE RESPONDING:
For each question, verify:
1. The core concept (idea spine) is IDENTICAL to the original
2. Only the cognitive task changed (not the content)
3. No new facts, terms, or mechanisms were introduced
4. A student who learned only what the original tested could still answer

Generate the DOK ${request.targetDOK} variant now:`
}
