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
  LessonGenerationContext,
  ComponentExpansionRequest
} from '../../../shared/types/ai.types'
import type { MultipleChoiceQuestion } from '../../../shared/types/question.types'
import type { LearningGoal } from '../../../shared/types/lesson.types'
import type {
  MaterialGenerationRequest,
  GraphicOrganizerTemplate,
  PuzzleVocabularyRequest
} from '../../../shared/types/material.types'

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

  // ============================================
  // Lesson Generation Prompts
  // ============================================

  lessonGoalsGeneration: `You are an expert curriculum designer specializing in Backward Design (Understanding by Design). Your task is to create clear, measurable learning goals aligned to standards.

GUIDELINES FOR LEARNING GOALS:
- Use the SWBAT (Students Will Be Able To) format
- Start with strong action verbs from Bloom's Taxonomy
- Be specific and measurable (avoid vague verbs like "understand" or "know")
- Focus on what students will DO to demonstrate learning
- Align each goal directly to the provided standards
- Consider the lesson duration when setting scope
- Include a mix of cognitive levels appropriate for the grade

BLOOM'S TAXONOMY VERBS (by level):
- Remember: define, list, recall, identify, name, state
- Understand: explain, summarize, describe, compare, interpret
- Apply: demonstrate, solve, use, illustrate, construct
- Analyze: differentiate, examine, compare, contrast, categorize
- Evaluate: judge, critique, assess, justify, defend
- Create: design, develop, compose, construct, formulate`,

  lessonStructureGeneration: `You are an expert instructional designer. Your task is to create a complete lesson structure following the Gradual Release of Responsibility (I Do, We Do, You Do) model.

LESSON FLOW PRINCIPLES:
1. BELLRINGER: Activate prior knowledge or spark curiosity (3-5 min)
2. OBJECTIVE: Share learning goals clearly with students
3. DIRECT INSTRUCTION (I Do): Teacher models, explains, demonstrates
4. GUIDED PRACTICE (We Do): Teacher and students work together
5. INDEPENDENT PRACTICE (You Do): Students apply learning independently
6. FORMATIVE CHECK: Quick assessment of understanding
7. CLOSURE: Summarize learning and preview what's next

GUIDELINES:
- Match activities to learning goals
- Include transition cues between components
- Build in time for student questions
- Suggest specific strategies and activities
- Consider pacing based on total lesson time
- Include differentiation ideas where appropriate
- Balance teacher talk with student activity`,

  componentExpansion: `You are an expert instructional coach. Your task is to expand a lesson component with detailed, actionable content that a teacher can use directly in their classroom.

INCLUDE IN YOUR EXPANSION:
- Step-by-step teacher actions
- Suggested teacher language/scripts
- Expected student responses or behaviors
- Materials or preparation needed
- Questions to ask students
- Differentiation strategies (support and extension)
- Common misconceptions to address
- Assessment opportunities within the component
- Timing cues and transitions`
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

// ============================================
// Lesson Generation Prompt Builders
// ============================================

/**
 * Build the prompt for generating learning goals from standards
 */
export function buildLessonGoalsPrompt(
  context: LessonGenerationContext,
  standardsText: string
): string {
  const materialsNote = context.unitMaterialsContext
    ? `\nRELEVANT UNIT MATERIALS:\n${context.unitMaterialsContext.slice(0, 2000)}`
    : ''

  const priorNote = context.priorKnowledge
    ? `\nSTUDENT PRIOR KNOWLEDGE: ${context.priorKnowledge}`
    : ''

  const needsNote = context.studentNeeds
    ? `\nSTUDENT NEEDS: ${context.studentNeeds}`
    : ''

  return `Generate learning goals for a ${context.durationMinutes}-minute ${context.subject} lesson for grade ${context.gradeLevel} students.

STANDARDS TO ADDRESS:
${standardsText}
${materialsNote}${priorNote}${needsNote}

REQUIREMENTS:
- Generate 2-4 SWBAT learning goals appropriate for a ${context.durationMinutes}-minute lesson
- Each goal should align to at least one standard
- Include goals at different cognitive levels
- Make goals specific and measurable
- Generate 2-4 success criteria students can use to self-assess

OUTPUT FORMAT:
Return ONLY a valid JSON object with no additional text:
{
  "goals": [
    {
      "id": "goal-1",
      "text": "Students will be able to [specific action verb] [specific content] [optional: condition/context].",
      "standardRef": "STANDARD-CODE"
    }
  ],
  "successCriteria": [
    "I can [specific observable behavior].",
    "I can [specific observable behavior]."
  ]
}

Generate the learning goals now:`
}

/**
 * Build the prompt for generating lesson structure
 */
export function buildLessonStructurePrompt(
  context: LessonGenerationContext,
  goals: LearningGoal[],
  standardsText: string
): string {
  const goalsText = goals.map((g, i) => `${i + 1}. ${g.text}`).join('\n')

  const materialsNote = context.availableMaterials?.length
    ? `\nAVAILABLE MATERIALS: ${context.availableMaterials.join(', ')}`
    : ''

  const needsNote = context.studentNeeds
    ? `\nSTUDENT NEEDS TO CONSIDER: ${context.studentNeeds}`
    : ''

  return `Create a complete lesson structure for a ${context.durationMinutes}-minute ${context.subject} lesson for grade ${context.gradeLevel} students.

LEARNING GOALS:
${goalsText}

STANDARDS:
${standardsText}
${materialsNote}${needsNote}

REQUIREMENTS:
- Total time must equal ${context.durationMinutes} minutes
- Include appropriate components following Gradual Release of Responsibility
- Each component should contribute to achieving the learning goals
- Suggest specific activities, not generic descriptions
- Include timing for each component

COMPONENT TYPES AVAILABLE:
- bellringer: Opening warm-up (3-5 min)
- objective: Share goals with students (2-3 min)
- direct: Direct instruction / I Do (10-15 min typically)
- guided: Guided practice / We Do (8-12 min typically)
- independent: Independent practice / You Do (10-15 min typically)
- collaborative: Group work
- check: Formative check / exit ticket (3-5 min)
- closure: Lesson wrap-up (3-5 min)
- extension: For early finishers

OUTPUT FORMAT:
Return ONLY a valid JSON object with no additional text:
{
  "components": [
    {
      "id": "comp-1",
      "type": "bellringer",
      "title": "Opening Activity",
      "description": "Specific description of the activity",
      "estimatedMinutes": 5,
      "order": 0,
      "teacherNotes": "What the teacher should do/say",
      "studentInstructions": "What students should do"
    }
  ],
  "totalMinutes": ${context.durationMinutes}
}

Generate the lesson structure now:`
}

/**
 * Build the prompt for expanding a single lesson component
 */
export function buildComponentExpansionPrompt(
  request: ComponentExpansionRequest,
  standardsText: string
): string {
  const componentJson = JSON.stringify(
    {
      type: request.component.type,
      title: request.component.title,
      description: request.component.description,
      estimatedMinutes: request.component.estimatedMinutes
    },
    null,
    2
  )

  const goalsText = request.goals?.length
    ? `\nLEARNING GOALS:\n${request.goals.map((g) => `- ${g.text}`).join('\n')}`
    : ''

  return `Expand this ${request.component.type} component for a grade ${request.context.gradeLevel} ${request.context.subject} lesson.

COMPONENT TO EXPAND:
${componentJson}
${goalsText}

STANDARDS:
${standardsText}

TIME AVAILABLE: ${request.component.estimatedMinutes} minutes

REQUIREMENTS:
- Provide detailed, step-by-step teacher actions
- Include suggested teacher language/scripts
- Describe expected student responses
- List any materials or preparation needed
- Include 2-3 discussion questions
- Suggest differentiation for struggling and advanced students
- Address common misconceptions
- Include transition to next component

OUTPUT FORMAT:
Return ONLY a valid JSON object with no additional text:
{
  "title": "Updated title if needed",
  "description": "Expanded description of the activity",
  "estimatedMinutes": ${request.component.estimatedMinutes},
  "teacherNotes": "Detailed step-by-step teacher actions and suggested language",
  "studentInstructions": "Clear instructions for students",
  "materials": ["List of materials needed"],
  "discussionQuestions": ["Question 1", "Question 2"],
  "differentiation": {
    "support": "Strategies for struggling students",
    "extension": "Challenges for advanced students"
  },
  "misconceptions": ["Common misconception 1", "Common misconception 2"],
  "transitionCue": "How to transition to the next component"
}

Expand the component now:`
}

// ============================================
// Material Generation System Prompts
// ============================================

export const MATERIAL_SYSTEM_PROMPTS = {
  worksheetGeneration: `You are an expert educational content creator specializing in creating practice worksheets and problem sets. Your task is to create high-quality, engaging practice materials that reinforce learning.

GUIDELINES:
- Create questions that progress from easier to harder (scaffolded difficulty)
- Include a variety of question types (fill-in-blank, short answer, multiple choice)
- Ensure questions directly relate to the learning goals
- Use clear, grade-appropriate language
- Include space for student work where appropriate
- Create questions that test understanding, not just recall`,

  vocabularyExtraction: `You are an expert curriculum specialist. Your task is to extract key vocabulary terms from lesson content and create educational definitions and clues suitable for study materials and puzzles.

GUIDELINES:
- Select terms central to understanding the topic
- Prioritize content-specific vocabulary over common words
- Create definitions appropriate for the target grade level
- Write clues that test understanding, not just memorization
- Include context clues when helpful`,

  graphicOrganizerGeneration: `You are an expert instructional designer specializing in visual learning tools. Your task is to create content for graphic organizers that help students organize and connect information.

GUIDELINES:
- Structure content logically based on the organizer type
- Keep entries concise but meaningful
- Show relationships between concepts
- Use language appropriate for the grade level
- Ensure content aligns with learning goals`,

  diagramGeneration: `You are an expert educational illustrator. Your task is to create detailed prompts for generating educational diagrams that support student learning.

GUIDELINES:
- Be specific about visual elements needed
- Include labels and annotations
- Request clear, simple illustrations appropriate for the grade level
- Focus on accuracy of educational content
- Specify colors and layout when important for understanding`,

  exitTicketGeneration: `You are an expert in formative assessment. Your task is to create quick, focused exit ticket questions that check for understanding of key lesson concepts.

GUIDELINES:
- Focus on the most essential learning from the lesson
- Include a mix of check questions (did they learn it?) and reflection questions (how did they learn?)
- Keep questions brief and answerable in 3-5 minutes total
- Questions should reveal misconceptions if they exist
- Include at least one question requiring explanation/reasoning`
}

// ============================================
// Material Generation Prompt Builders
// ============================================

/**
 * Build the prompt for generating worksheet/practice problems
 */
export function buildWorksheetPrompt(
  request: MaterialGenerationRequest,
  standardsText: string
): string {
  const questionCount = request.options?.questionCount ?? 10
  const includeAnswerKey = request.options?.includeAnswerKey !== false
  const difficulty = request.options?.difficulty ?? 'mixed'

  const goalsText = request.learningGoals?.length
    ? `\nLEARNING GOALS:\n${request.learningGoals.map((g) => `- ${g.text}`).join('\n')}`
    : ''

  return `Create a practice worksheet for grade ${request.gradeLevel} ${request.subject} students on the topic: "${request.topic}".

STANDARDS:
${standardsText}
${goalsText}

REQUIREMENTS:
- Generate ${questionCount} practice questions
- Difficulty distribution: ${difficulty === 'mixed' ? 'Start easier, progress to harder' : difficulty}
- Include a variety of question types:
  * Multiple choice (3-4 questions)
  * Fill-in-the-blank (2-3 questions)
  * Short answer requiring explanation (3-4 questions)
${includeAnswerKey ? '- Include complete answer key with explanations' : ''}
${request.additionalInstructions ? `\nADDITIONAL INSTRUCTIONS: ${request.additionalInstructions}` : ''}

OUTPUT FORMAT:
Return ONLY a valid JSON object:
{
  "title": "Worksheet title",
  "instructions": "Instructions for students",
  "questions": [
    {
      "number": 1,
      "text": "Question text",
      "type": "multiple-choice" | "short-answer" | "fill-blank",
      "choices": [{"id": "a", "text": "Choice"}, ...],
      "correctAnswer": "The correct answer or choice ID",
      "explanation": "Why this is correct",
      "points": 1
    }
  ],
  "answerKey": ["1. Answer with explanation", "2. Answer with explanation", ...]
}

Generate the worksheet now:`
}

/**
 * Build the prompt for extracting vocabulary for puzzles
 */
export function buildPuzzleVocabularyPrompt(request: PuzzleVocabularyRequest): string {
  const contextNote = request.existingContent
    ? `\nLESSON CONTENT TO EXTRACT FROM:\n${request.existingContent.slice(0, 3000)}`
    : ''

  return `Generate ${request.wordCount} vocabulary terms for a word puzzle for grade ${request.gradeLevel} ${request.subject} students on the topic: "${request.topic}".
${contextNote}

REQUIREMENTS:
- Select key terms that are central to understanding ${request.topic}
- Words should be 4-15 letters long (suitable for puzzles)
- Create clues that test understanding, not just definitions
- Vary difficulty: some easier terms, some more challenging
- Avoid overly technical jargon unless grade-appropriate

OUTPUT FORMAT:
Return ONLY a valid JSON object:
{
  "vocabulary": [
    {
      "word": "TERM",
      "clue": "A clue that helps identify this term",
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}

Generate the vocabulary now:`
}

/**
 * Build the prompt for generating vocabulary list content
 */
export function buildVocabularyListPrompt(
  request: MaterialGenerationRequest,
  standardsText: string
): string {
  const wordCount = request.options?.wordCount ?? 10
  const includeExamples = request.options?.includeExamples !== false

  return `Create a vocabulary study list for grade ${request.gradeLevel} ${request.subject} students on the topic: "${request.topic}".

STANDARDS:
${standardsText}

REQUIREMENTS:
- Generate ${wordCount} essential vocabulary terms
- Definitions should be grade-appropriate and clear
${includeExamples ? '- Include example sentences showing proper usage' : ''}
- Include part of speech where relevant
- Order from foundational terms to more complex

OUTPUT FORMAT:
Return ONLY a valid JSON object:
{
  "title": "Vocabulary: ${request.topic}",
  "vocabulary": [
    {
      "term": "The vocabulary word",
      "definition": "Clear, grade-appropriate definition",
      "example": "Example sentence using the term",
      "partOfSpeech": "noun/verb/adjective/etc"
    }
  ]
}

Generate the vocabulary list now:`
}

/**
 * Build the prompt for generating graphic organizer content
 */
export function buildGraphicOrganizerPrompt(
  request: MaterialGenerationRequest,
  standardsText: string
): string {
  const template = request.options?.template ?? 'concept-map'
  const itemCount = request.options?.itemCount ?? 4

  const templateInstructions: Record<GraphicOrganizerTemplate, string> = {
    'venn-diagram': `Compare and contrast 2-3 items related to ${request.topic}. Include unique characteristics and shared traits.`,
    'concept-map': `Create a central concept with ${itemCount} main branches, each with 2-3 supporting details.`,
    'flowchart': `Show the sequence or process of ${request.topic} with ${itemCount}-${itemCount + 2} steps.`,
    'kwl-chart': `Generate "What I Know" (prior knowledge), "What I Want to Know" (questions), and sample "What I Learned" items.`,
    'cause-effect': `Show ${itemCount} cause-and-effect relationships related to ${request.topic}.`,
    'timeline': `Create a timeline with ${itemCount}-${itemCount + 2} key events or stages.`,
    'main-idea': `Identify the main idea with ${itemCount} supporting details and evidence.`,
    'comparison-matrix': `Compare ${itemCount} items across 3-4 criteria or characteristics.`
  }

  const goalsText = request.learningGoals?.length
    ? `\nLEARNING GOALS:\n${request.learningGoals.map((g) => `- ${g.text}`).join('\n')}`
    : ''

  return `Create content for a ${template} graphic organizer for grade ${request.gradeLevel} ${request.subject} students on: "${request.topic}".

STANDARDS:
${standardsText}
${goalsText}

TEMPLATE TYPE: ${template}
INSTRUCTIONS: ${templateInstructions[template]}

OUTPUT FORMAT:
Return ONLY a valid JSON object:
{
  "template": "${template}",
  "title": "Organizer title",
  "items": [
    {
      "id": "item-1",
      "label": "Item label or category",
      "content": ["Detail 1", "Detail 2", "Detail 3"]
    }
  ],
  "connections": [
    {"from": "item-1", "to": "item-2", "label": "relationship description"}
  ]
}

Generate the graphic organizer content now:`
}

/**
 * Build the prompt for generating exit ticket questions
 */
export function buildExitTicketPrompt(
  request: MaterialGenerationRequest,
  standardsText: string
): string {
  const questionCount = request.options?.exitTicketQuestions ?? 3

  const goalsText = request.learningGoals?.length
    ? `\nLEARNING GOALS:\n${request.learningGoals.map((g) => `- ${g.text}`).join('\n')}`
    : ''

  return `Create an exit ticket for grade ${request.gradeLevel} ${request.subject} students on: "${request.topic}".

STANDARDS:
${standardsText}
${goalsText}

REQUIREMENTS:
- Generate ${questionCount} questions total
- Include at least one "check" question (tests if they learned the content)
- Include at least one "reflection" or "application" question
- Questions should be answerable in 3-5 minutes total
- Questions should reveal misconceptions

OUTPUT FORMAT:
Return ONLY a valid JSON object:
{
  "title": "Exit Ticket: ${request.topic}",
  "questions": [
    {
      "number": 1,
      "text": "Question text",
      "type": "check" | "reflection" | "application",
      "lines": 2
    }
  ]
}

Generate the exit ticket now:`
}

/**
 * Build the prompt for generating an educational diagram (for image AI)
 */
export function buildDiagramPrompt(
  request: MaterialGenerationRequest
): string {
  const style = request.options?.diagramStyle ?? 'labeled'
  const includeLabels = request.options?.includeLabels !== false

  const styleInstructions = {
    simple: 'Create a simple, clean illustration with minimal detail',
    labeled: 'Create a detailed diagram with clear labels and annotations',
    detailed: 'Create a comprehensive, detailed illustration with extensive labels'
  }

  return `Create an educational diagram for grade ${request.gradeLevel} ${request.subject} students.

TOPIC: ${request.topic}

STYLE: ${styleInstructions[style]}

REQUIREMENTS:
- Educational accuracy is essential
- Use clear, simple shapes and colors
- Appropriate for ${request.gradeLevel} students
${includeLabels ? '- Include clear text labels on all important parts' : '- Minimal text, focus on visual elements'}
- White or light background for printability
- Professional, textbook-quality appearance
${request.additionalInstructions ? `\nSPECIFIC INSTRUCTIONS: ${request.additionalInstructions}` : ''}

Create this educational diagram: A clear, labeled diagram showing ${request.topic} suitable for grade ${request.gradeLevel} ${request.subject} class. The diagram should be accurate, educational, and easy to understand.`
}
