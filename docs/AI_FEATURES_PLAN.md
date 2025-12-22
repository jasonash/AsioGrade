# AI Features Implementation Plan

**Version:** 1.0
**Created:** 2025-12-21
**Status:** Active

---

## 1. Overview

This document provides comprehensive implementation guidance for AI-assisted features in TeachingHelp, specifically:

1. **AI-Assisted Assessment Creation** - Intelligent question generation, refinement, and import
2. **AI-Assisted Lesson Planning** - Backward Design-driven lesson creation with standards alignment

These features build on the existing LLM service infrastructure and integrate deeply with the standards, units, and assessment systems already in place.

### 1.1 Design Principles

| Principle | Description |
|-----------|-------------|
| **Teacher Authority** | AI assists but never decides; all outputs are reviewable and editable |
| **Standards-First** | All generation is anchored to curriculum standards |
| **Transparency** | Teachers can see what prompts were used and modify them |
| **Graceful Degradation** | Features work without AI; AI enhances but isn't required |
| **Cost Awareness** | Token usage is visible; expensive operations require confirmation |

### 1.2 Implementation Phases

| Phase | Name | Focus | Dependencies |
|-------|------|-------|--------------|
| **1** | Assessment AI Core | Question generation & refinement | Existing assessment infrastructure |
| **2** | Assessment AI Polish | Import, coverage analysis, variants | Phase 1 |
| **3** | Lesson Planning Core | Data model, basic AI generation | Phase 1 (shared AI patterns) |
| **4** | Lesson Planning Polish | Export, UDL, analytics integration | Phase 3, Analytics data |
| **5** | Material Generation | Auto-generate teaching materials | Phase 4 (future) |

---

## 2. Phase 1: Assessment AI Core

### 2.1 Goals

- Enable AI-powered question generation from standards
- Provide conversational refinement interface
- Support streaming for responsive UX
- Maintain full teacher control

### 2.2 Features

#### 2.2.1 Question Generation

**Trigger:** Teacher clicks "Generate Questions" in Assessment Editor

**Input Parameters:**
```typescript
interface QuestionGenerationRequest {
  // Context
  courseId: string;
  unitId: string;
  assessmentId: string;

  // Standards to cover
  standardRefs: string[];

  // Configuration
  questionCount: number;
  questionTypes: QuestionType[];  // 'multiple_choice', 'true_false', etc.

  // Optional constraints
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  avoidTopics?: string[];
  focusTopics?: string[];

  // Grade level (from course)
  gradeLevel: string;
  subject: string;
}
```

**Output:** Stream of generated questions matching the Question type from DATA_MODEL.md

#### 2.2.2 Question Refinement

**Commands the AI assistant should support:**

| Command | Description | Example |
|---------|-------------|---------|
| `simplify` | Reduce reading level | "Make this easier to understand" |
| `harder` | Increase difficulty | "Make this more challenging" |
| `distractors` | Improve wrong answers | "Make the distractors more plausible" |
| `rephrase` | Alternative wording | "Rephrase this question" |
| `hint` | Add scaffolding | "Add a hint for struggling students" |
| `explain` | Explain the answer | "Why is A the correct answer?" |

#### 2.2.3 Conversational Interface

The AI Assistant panel allows natural language interaction:

```
┌─────────────────────────────────────────┐
│  AI ASSISTANT                           │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ How can I help with your            ││
│  │ assessment?                         ││
│  │                                     ││
│  │ Quick actions:                      ││
│  │ • Generate 5 questions on [topic]   ││
│  │ • Improve selected question         ││
│  │ • Check standards coverage          ││
│  └─────────────────────────────────────┘│
│                                         │
│  ─────── Conversation ───────           │
│                                         │
│  You: Generate 5 questions about the   │
│  rock cycle for MS-ESS2-1              │
│                                         │
│  AI: I'll generate 5 multiple choice   │
│  questions about the rock cycle...     │
│  [Streaming response with questions]   │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ Type a message...            [Send] ││
│  └─────────────────────────────────────┘│
│                                         │
└─────────────────────────────────────────┘
```

### 2.3 LLM Prompt Templates

#### 2.3.1 Question Generation System Prompt

```
You are an expert educational assessment developer specializing in {subject} education for grade {gradeLevel} students.

Your task is to create high-quality assessment questions that:
1. Align directly to the provided learning standards
2. Use age-appropriate vocabulary and reading level
3. Test understanding, not just recall
4. Have plausible distractors based on common misconceptions
5. Are clear, unambiguous, and free from bias

STANDARDS TO ASSESS:
{standards_list}

QUESTION REQUIREMENTS:
- Question types: {question_types}
- Difficulty: {difficulty}
- Total questions: {count}

OUTPUT FORMAT:
Return questions as a JSON array. Each question must include:
- type: The question type
- text: The question stem
- choices: Array of answer options (for multiple choice)
- correctAnswer: The correct answer identifier
- standardRef: Which standard this assesses
- explanation: Brief explanation of why the answer is correct

GUIDELINES:
- Distribute questions evenly across standards when possible
- Vary question complexity within the difficulty level
- Avoid "all of the above" or "none of the above"
- Make distractors plausible but clearly incorrect to someone who understands the concept
- Avoid negative phrasing ("Which is NOT...")
- Keep question stems concise but complete
```

#### 2.3.2 Question Refinement Prompts

**Simplify:**
```
Rewrite this question for a lower reading level while maintaining the same concept being assessed.
Keep the cognitive demand similar but use simpler vocabulary and shorter sentences.

Original question:
{question}

Target grade level: {gradeLevel}
Standard being assessed: {standardRef}
```

**Improve Distractors:**
```
Improve the distractors (wrong answers) for this multiple choice question.
Good distractors should:
1. Be plausible to students who have misconceptions
2. Be clearly wrong to students who understand the concept
3. Be similar in length and structure to the correct answer
4. Not be obviously wrong or silly

Current question:
{question}

Common misconceptions for this topic:
{misconceptions_if_available}

Return the improved question with better distractors.
```

### 2.4 Data Model Changes

#### 2.4.1 AI Generation Metadata

Add to existing Question interface:

```typescript
interface Question {
  // ... existing fields ...

  // AI generation tracking (optional)
  aiGenerated?: boolean;
  aiModel?: string;
  aiGeneratedAt?: string;
  aiPromptHash?: string;  // For reproducibility
}
```

#### 2.4.2 Conversation History

```typescript
interface AIConversation {
  id: string;
  assessmentId: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}

interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;

  // For assistant messages that generated questions
  generatedQuestions?: string[];  // Question IDs

  // Token usage tracking
  tokenUsage?: {
    input: number;
    output: number;
  };
}
```

### 2.5 Service Layer

#### 2.5.1 New IPC Handlers

```typescript
// In preload API
llm: {
  // Existing
  complete: (prompt: string, options: LLMOptions) => Promise<LLMResponse>,
  stream: (prompt: string, options: LLMOptions) => AsyncGenerator<string>,

  // New for Phase 1
  generateQuestions: (request: QuestionGenerationRequest) => Promise<GeneratedQuestion[]>,
  streamQuestions: (request: QuestionGenerationRequest) => void,  // Events sent via IPC
  refineQuestion: (question: Question, command: string) => Promise<Question>,

  // Conversation
  chat: (assessmentId: string, message: string) => Promise<AIMessage>,
  getConversation: (assessmentId: string) => Promise<AIConversation>,
}
```

#### 2.5.2 Event Handling for Streaming

```typescript
// Main process sends events during streaming
type QuestionStreamEvent =
  | { type: 'start'; totalExpected: number }
  | { type: 'question'; question: Question; index: number }
  | { type: 'progress'; message: string }
  | { type: 'complete'; questions: Question[] }
  | { type: 'error'; error: string };

// Renderer listens
window.api.on('llm:questionStream', (event: QuestionStreamEvent) => {
  // Update UI progressively
});
```

### 2.6 UI Components

#### 2.6.1 New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `AIAssistantPanel` | `components/assessment/AIAssistantPanel.tsx` | Conversational AI interface |
| `QuestionGenerationModal` | `components/assessment/QuestionGenerationModal.tsx` | Configure generation parameters |
| `GeneratedQuestionCard` | `components/assessment/GeneratedQuestionCard.tsx` | Review/accept/reject generated questions |
| `AILoadingIndicator` | `components/common/AILoadingIndicator.tsx` | Streaming progress indicator |

#### 2.6.2 AIAssistantPanel Specification

```typescript
interface AIAssistantPanelProps {
  assessmentId: string;
  standards: Standard[];
  onQuestionsGenerated: (questions: Question[]) => void;
  onQuestionRefined: (questionId: string, refined: Question) => void;
  selectedQuestionId?: string;  // For contextual refinement
}

// State
interface AIAssistantState {
  conversation: AIMessage[];
  isGenerating: boolean;
  streamingContent: string;
  pendingQuestions: Question[];  // Questions waiting for approval
}
```

### 2.7 Known Limitations (To Revisit)

#### 2.7.1 Chat Context Limitations

The current chat implementation has limited context awareness:

**Current State:**
- Chat knows: assessment title, subject, grade level, standards codes, question count
- Chat does NOT know: actual question content, full standards descriptions, conversation history

**Impact:**
- Cannot answer "what topics haven't I covered?" (doesn't know question content)
- Cannot reference previous messages in conversation
- Limited usefulness compared to "Generate Questions" button

**Future Enhancement:**
When revisiting the chat feature, add:
1. Pass existing questions array to context
2. Include full standards text (not just codes)
3. Implement conversation history for multi-turn context
4. Consider token budget implications of richer context

**Priority:** Low (Generate Questions button is primary workflow)

---

### 2.8 Acceptance Criteria

#### 2.8.1 Question Generation

- [ ] User can generate questions from selected standards
- [ ] Questions stream in progressively (not all at once)
- [ ] Each generated question shows its aligned standard
- [ ] User can accept, reject, or edit each question
- [ ] Accepted questions are added to assessment
- [ ] Token usage is displayed after generation

#### 2.8.2 Question Refinement

- [ ] User can select a question and request refinement
- [ ] Refinement commands work: simplify, harder, distractors, rephrase
- [ ] Original question is preserved; user chooses to accept refinement
- [ ] Refinement shows before/after comparison

#### 2.8.3 Conversational Interface

- [ ] Natural language input is understood
- [ ] Conversation history persists during session
- [ ] Quick action buttons work for common tasks
- [ ] Error states are handled gracefully

---

## 3. Phase 2: Assessment AI Polish

### 3.1 Goals

- Import questions from existing materials (PDF, DOCX)
- Analyze standards coverage
- Generate variant questions for UDL support

### 3.2 Features

#### 3.2.1 Material Import

**Workflow:**
1. User uploads PDF or DOCX
2. AI extracts text and identifies question-like content
3. AI structures into Question format
4. User reviews and edits
5. Approved questions added to assessment

**Extraction Prompt:**
```
Analyze this educational document and extract any assessment questions you find.
For each question:
1. Identify the question type (multiple choice, true/false, matching, etc.)
2. Extract the question stem
3. Extract all answer choices
4. Identify the correct answer if marked
5. Note any associated topic or standard reference

Document content:
{document_text}

Return structured questions in JSON format.
If no questions are found, return an empty array.
If content looks like study material rather than questions, suggest how it could be converted to questions.
```

#### 3.2.2 Coverage Analysis

```typescript
interface CoverageAnalysis {
  standardsCovered: {
    standardRef: string;
    questionCount: number;
    totalPoints: number;
  }[];

  standardsUncovered: string[];  // Standards in unit not yet assessed

  recommendations: string[];  // "Consider adding questions for MS-ESS2-3"

  balance: 'good' | 'uneven' | 'poor';
}
```

**UI Display:**
```
┌─────────────────────────────────────────┐
│  STANDARDS COVERAGE                      │
├─────────────────────────────────────────┤
│                                         │
│  MS-ESS2-1  ████████████░░  4 questions │
│  MS-ESS2-2  ██████████████  5 questions │
│  MS-ESS2-3  ████░░░░░░░░░░  1 question  │
│  MS-ESS2-4  ░░░░░░░░░░░░░░  0 questions │
│                                         │
│  ⚠ Recommendation: Add 2-3 questions   │
│    for MS-ESS2-3 and MS-ESS2-4         │
│                                         │
│  [Generate Missing Questions]           │
│                                         │
└─────────────────────────────────────────┘
```

#### 3.2.3 Variant Generation

For UDL support, generate alternative versions:

```typescript
interface VariantGenerationRequest {
  questionId: string;
  variantType: 'simplified' | 'scaffolded' | 'extended';

  // For simplified
  targetReadingLevel?: string;

  // For scaffolded
  hintsToAdd?: number;

  // For extended
  additionalComplexity?: string;
}
```

### 3.3 Acceptance Criteria

#### 3.3.1 Material Import

- [ ] PDF upload extracts text successfully
- [ ] DOCX upload extracts text successfully
- [ ] AI identifies questions in extracted text
- [ ] User can review and edit extracted questions
- [ ] Non-question content is handled gracefully

#### 3.3.2 Coverage Analysis

- [ ] Coverage visualization shows all unit standards
- [ ] Uncovered standards are highlighted
- [ ] Recommendations are actionable
- [ ] "Generate Missing Questions" creates appropriate questions

#### 3.3.3 Variant Generation

- [ ] Simplified variants have lower reading level
- [ ] Scaffolded variants include helpful hints
- [ ] Extended variants have additional complexity
- [ ] Variants are linked to base questions

---

## 4. Phase 3: Lesson Planning Core

### 4.1 Goals

- Establish lesson data model
- Create lesson editor UI
- Enable AI-assisted lesson structure generation
- Follow Backward Design principles
- **Implement unit-level materials storage for AI context**

### 4.1.1 Unit-Level Materials (Critical Design Decision)

**IMPORTANT:** Teaching materials (slides, notes, worksheets, etc.) are stored at the **unit level**, not the course level. This is intentional:

1. **Pedagogical Reasoning:** Content from Unit 1 (e.g., "Introduction to Matter") shouldn't influence AI generation for Unit 5 (e.g., "Chemical Reactions"). Each unit has its own focused content.

2. **AI Context:** When generating questions or lesson plans, the AI uses:
   - **Standards** (what should be taught)
   - **Unit materials** (what was actually taught in this unit)
   - **Assessment data** (what students struggled with - Phase 4)

3. **Folder Structure:**
   ```
   /units/{unit-id}/
       ├── meta.json
       ├── materials/           # Unit-specific teaching materials
       │   ├── slides.pdf
       │   ├── notes.docx
       │   └── worksheet.pdf
       ├── assessments/
       └── lessons/
   ```

4. **Material Usage:**
   - **Assessment Generation:** AI reads unit materials to generate questions relevant to what was taught
   - **Lesson Planning:** AI uses materials as context for creating coherent lessons
   - **NOT for:** Cross-unit content (each unit is independent)

5. **Implementation Notes:**
   - Materials are uploaded/linked per unit
   - Text is extracted and cached for AI prompts
   - Teachers control which materials are used as context
   - Token budget considerations for large documents

### 4.2 Data Model

#### 4.2.1 Lesson Structure

```typescript
interface Lesson {
  id: string;
  unitId: string;
  courseId: string;

  // Basic info
  title: string;
  description?: string;
  order: number;
  estimatedMinutes: number;

  // Standards alignment
  standardRefs: string[];

  // Backward Design elements
  learningGoals: LearningGoal[];
  successCriteria: string[];

  // Lesson structure
  components: LessonComponent[];

  // Materials
  materials: LessonMaterial[];

  // UDL considerations
  udlNotes?: UDLNotes;

  // Metadata
  status: 'draft' | 'ready' | 'taught';
  aiGenerated: boolean;

  createdAt: string;
  updatedAt: string;
  version: number;
}

interface LearningGoal {
  id: string;
  text: string;
  standardRef?: string;
  assessedBy?: string[];  // Component IDs that assess this goal
}

interface LessonComponent {
  id: string;
  type: LessonComponentType;
  title: string;
  description: string;
  estimatedMinutes: number;

  // Detailed content
  teacherNotes?: string;
  studentInstructions?: string;

  // Resources
  materials?: string[];

  // For formative checks
  assessmentQuestions?: string[];

  order: number;
}

type LessonComponentType =
  | 'bellringer'      // Opening activity
  | 'objective'       // Share learning goals
  | 'direct'          // Direct instruction
  | 'guided'          // Guided practice
  | 'independent'     // Independent practice
  | 'collaborative'   // Group work
  | 'check'           // Formative check
  | 'closure'         // Lesson wrap-up
  | 'extension';      // For early finishers

interface LessonMaterial {
  id: string;
  name: string;
  type: 'handout' | 'slide' | 'video' | 'link' | 'equipment' | 'other';
  url?: string;
  driveFileId?: string;
  notes?: string;
}

interface UDLNotes {
  engagement: string[];      // Multiple means of engagement
  representation: string[];  // Multiple means of representation
  expression: string[];      // Multiple means of action/expression
}
```

#### 4.2.2 Google Drive Structure Addition

```
/TeachingHelp/
└── years/
    └── 2024-2025/
        └── courses/
            └── {course-id}/
                └── units/
                    └── {unit-id}/
                        ├── meta.json
                        ├── materials/            # Unit teaching materials (for AI context)
                        │   ├── slides.pdf
                        │   ├── notes.docx
                        │   └── ...
                        ├── assessments/
                        └── lessons/              # NEW
                            └── {lesson-id}.json
```

**Note:** Materials are stored at the unit level, NOT course level. This ensures AI-generated content (questions, lessons) is contextually relevant to the specific unit being taught.

### 4.3 Lesson Generation Workflow

#### 4.3.1 Step 1: Context Setup

```typescript
interface LessonGenerationContext {
  courseId: string;
  unitId: string;

  // What to teach
  standardRefs: string[];
  topics?: string[];

  // Constraints
  durationMinutes: number;

  // Unit materials context (extracted text from uploaded materials)
  unitMaterialsContext?: string;  // Concatenated/summarized text from unit materials

  // Optional context
  priorKnowledge?: string;
  studentNeeds?: string;
  availableMaterials?: string[];  // List of material names available in the unit

  // Analytics input (Phase 4)
  strugglingTopics?: string[];
}
```

**Unit Materials Usage:**
When `unitMaterialsContext` is provided, AI generation uses it to:
- Generate questions based on specific content taught (not just standards)
- Create lessons that reference actual materials students have seen
- Suggest activities that build on existing worksheets/slides

#### 4.3.2 Step 2: Learning Goals Generation

**Prompt:**
```
Based on these learning standards, generate clear, measurable learning goals for a {duration}-minute lesson.

Standards:
{standards_list}

Grade level: {gradeLevel}
Subject: {subject}

Generate 2-4 learning goals that:
1. Start with "Students will be able to..." (SWBAT)
2. Use measurable action verbs (explain, compare, analyze, create, etc.)
3. Are achievable within the time frame
4. Align directly to the standards

Also suggest 2-3 success criteria for each goal that describe what mastery looks like.

Return as JSON with goals and criteria.
```

#### 4.3.3 Step 3: Lesson Structure Generation

**Prompt:**
```
Create a lesson structure for teaching the following:

Learning Goals:
{learning_goals}

Standards:
{standards_list}

Duration: {duration} minutes
Grade level: {gradeLevel}
Subject: {subject}

Create a structured lesson with these components (adjust timing as needed):
- Bellringer/warm-up (3-5 min)
- Share objectives (2 min)
- Direct instruction (10-15 min)
- Guided practice (10-15 min)
- Independent/collaborative practice (10-15 min)
- Formative check (5 min)
- Closure (3-5 min)

For each component provide:
- Title
- Brief description
- Estimated time
- Key teacher actions
- Key student actions

Ensure the lesson follows gradual release of responsibility (I do, We do, You do).
Include at least one formative check to assess understanding.

Return as structured JSON.
```

### 4.4 UI Components

#### 4.4.1 Lesson Editor Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  📚 Lesson: Introduction to Plate Tectonics    [Save] [Preview]  │
│     Unit 2 | 50 minutes | Standards: MS-ESS2-2, MS-ESS2-3       │
│                                                                   │
│  ┌──────────────────────────────┬────────────────────────────────┐
│  │                              │                                │
│  │  LEARNING GOALS              │  AI ASSISTANT                  │
│  │  ─────────────────────────   │  ───────────────────────────   │
│  │                              │                                │
│  │  □ SWBAT explain how         │  Quick actions:                │
│  │    convection currents       │  • Generate lesson components  │
│  │    drive plate movement      │  • Suggest activities          │
│  │                              │  • Add formative check         │
│  │  □ SWBAT identify the        │  • Generate materials          │
│  │    three types of plate      │                                │
│  │    boundaries                │  ─────────────────────────     │
│  │                              │                                │
│  │  [+ Add Goal]                │  [Chat interface below]        │
│  │                              │                                │
│  ├──────────────────────────────┤                                │
│  │                              │                                │
│  │  LESSON FLOW                 │                                │
│  │  ─────────────────────────   │                                │
│  │                              │                                │
│  │  ┌────────────────────────┐  │                                │
│  │  │ 🔔 Bellringer    5 min │  │                                │
│  │  │ Earthquake video clip  │  │                                │
│  │  └────────────────────────┘  │                                │
│  │           ↓                  │                                │
│  │  ┌────────────────────────┐  │                                │
│  │  │ 🎯 Objectives    2 min │  │                                │
│  │  │ Share learning goals   │  │                                │
│  │  └────────────────────────┘  │                                │
│  │           ↓                  │                                │
│  │  ┌────────────────────────┐  │                                │
│  │  │ 📖 Direct       15 min │  │                                │
│  │  │ Plate tectonics intro  │  │                                │
│  │  │ [Expand to edit]       │  │                                │
│  │  └────────────────────────┘  │                                │
│  │           ↓                  │                                │
│  │  [+ Add Component]           │                                │
│  │                              │                                │
│  └──────────────────────────────┴────────────────────────────────┘
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.4.2 Component Editor (Expanded)

```
┌─────────────────────────────────────────────────────────────────┐
│  📖 Direct Instruction: Plate Tectonics Introduction    15 min  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Description:                                                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Introduce the concept of plate tectonics, including the     │ │
│  │ structure of Earth's lithosphere and the theory of          │ │
│  │ continental drift.                                          │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Teacher Notes:                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ • Start with Wegener's observations of continental fit      │ │
│  │ • Show animation of Pangaea breaking apart                  │ │
│  │ • Introduce convection currents as driving force            │ │
│  │ • Check for understanding: "What evidence supports..."      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Student Instructions:                                            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Follow along with the presentation and take notes on the    │ │
│  │ graphic organizer. Be ready to discuss the evidence for     │ │
│  │ plate tectonics.                                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  Materials: [+ Add]                                               │
│  • Plate tectonics slides                                        │
│  • Graphic organizer handout                                      │
│  • Pangaea animation video                                        │
│                                                                   │
│  [🤖 Expand with AI]  [Delete Component]              [Collapse] │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.5 Service Layer

```typescript
// New IPC handlers for lessons
lesson: {
  // CRUD
  list: (unitId: string) => Promise<LessonSummary[]>,
  get: (lessonId: string) => Promise<Lesson>,
  save: (lesson: Lesson) => Promise<void>,
  delete: (lessonId: string) => Promise<void>,
  reorder: (unitId: string, lessonIds: string[]) => Promise<void>,

  // AI generation
  generateGoals: (context: LessonGenerationContext) => Promise<LearningGoal[]>,
  generateStructure: (context: LessonGenerationContext, goals: LearningGoal[]) => Promise<LessonComponent[]>,
  expandComponent: (component: LessonComponent, context: LessonGenerationContext) => Promise<LessonComponent>,
  suggestActivities: (context: LessonGenerationContext) => Promise<ActivitySuggestion[]>,
}
```

### 4.6 Acceptance Criteria

#### 4.6.1 Lesson CRUD

- [ ] Create new lesson within a unit
- [ ] Edit lesson title, description, duration
- [ ] Add/edit/remove learning goals
- [ ] Add/edit/remove/reorder components
- [ ] Save lesson to Google Drive
- [ ] Delete lesson

#### 4.6.2 AI Generation

- [ ] Generate learning goals from standards
- [ ] Generate lesson structure from goals
- [ ] Expand individual components with AI
- [ ] Suggest activities for a component type

#### 4.6.3 UI/UX

- [ ] Lesson editor displays all components
- [ ] Drag-and-drop reordering works
- [ ] Component expansion shows full details
- [ ] AI assistant panel works for lessons
- [ ] Time totals update automatically

---

## 5. Phase 4: Lesson Planning Polish

### 5.1 Goals

- Export lessons to Google Docs/Slides
- Integrate analytics insights
- Full UDL support
- Material generation

### 5.2 Features

#### 5.2.1 Export to Google Docs

Generate a formatted lesson plan document:

```
┌─────────────────────────────────────────┐
│  LESSON PLAN                            │
│  ═══════════════════════════════════════│
│                                         │
│  Lesson: Introduction to Plate Tectonics│
│  Course: Earth Science                  │
│  Unit: Unit 2 - Plate Tectonics        │
│  Duration: 50 minutes                   │
│  Date: _______________                  │
│                                         │
│  STANDARDS                              │
│  ─────────────────────────────────────  │
│  • MS-ESS2-2: Describe plate movement  │
│  • MS-ESS2-3: Analyze data on plates   │
│                                         │
│  LEARNING OBJECTIVES                    │
│  ─────────────────────────────────────  │
│  Students will be able to:              │
│  1. Explain how convection currents...  │
│  2. Identify three types of plate...    │
│                                         │
│  SUCCESS CRITERIA                       │
│  ─────────────────────────────────────  │
│  • Students can label a diagram...      │
│  • Students can explain in writing...   │
│                                         │
│  MATERIALS                              │
│  ─────────────────────────────────────  │
│  • Slides presentation                  │
│  • Graphic organizer (1 per student)    │
│  • Video: Pangaea animation             │
│                                         │
│  LESSON PROCEDURE                       │
│  ─────────────────────────────────────  │
│                                         │
│  🔔 BELLRINGER (5 min)                  │
│  [Component details...]                 │
│                                         │
│  🎯 OBJECTIVES (2 min)                  │
│  [Component details...]                 │
│                                         │
│  [Continue for all components...]       │
│                                         │
│  DIFFERENTIATION                        │
│  ─────────────────────────────────────  │
│  [UDL notes...]                         │
│                                         │
│  ASSESSMENT                             │
│  ─────────────────────────────────────  │
│  [Formative check details...]           │
│                                         │
└─────────────────────────────────────────┘
```

#### 5.2.2 Analytics Integration

When creating or editing lessons, surface relevant insights:

```typescript
interface LessonAnalyticsContext {
  // From graded assessments
  strugglingStandards: {
    standardRef: string;
    averageScore: number;
    questionsMissed: string[];
  }[];

  // Recommendations
  recommendations: string[];
}
```

**UI Integration:**
```
┌─────────────────────────────────────────┐
│  📊 INSIGHTS FROM ASSESSMENTS           │
├─────────────────────────────────────────┤
│                                         │
│  Based on recent assessment results:    │
│                                         │
│  ⚠ Students struggled with:             │
│    • Convection currents (52% correct)  │
│    • Plate boundary types (61% correct) │
│                                         │
│  💡 Suggestion: Consider adding extra   │
│     practice on convection currents     │
│     during guided practice.             │
│                                         │
│  [Apply to Lesson]  [Dismiss]           │
│                                         │
└─────────────────────────────────────────┘
```

#### 5.2.3 UDL Support

AI-assisted UDL planning:

**Prompt:**
```
Review this lesson and suggest modifications following Universal Design for Learning (UDL) principles:

Lesson:
{lesson_json}

For each principle, suggest 2-3 specific strategies:

1. Multiple Means of Engagement (the "why" of learning)
   - How can we recruit interest?
   - How can we sustain effort and persistence?

2. Multiple Means of Representation (the "what" of learning)
   - How can we present information in different ways?
   - How can we support comprehension?

3. Multiple Means of Action & Expression (the "how" of learning)
   - How can students express what they know?
   - How can we support executive functions?

Return specific, actionable suggestions for this particular lesson.
```

### 5.3 Acceptance Criteria

#### 5.3.1 Export

- [ ] Export lesson to Google Docs
- [ ] Export lesson to PDF
- [ ] Exported format is clean and printable
- [ ] All lesson components included

#### 5.3.2 Analytics Integration

- [ ] Analytics insights appear when relevant
- [ ] Insights are based on actual assessment data
- [ ] "Apply to Lesson" incorporates suggestions
- [ ] Insights can be dismissed

#### 5.3.3 UDL

- [ ] UDL suggestions are generated for lessons
- [ ] Suggestions are specific to lesson content
- [ ] UDL notes can be saved with lesson
- [ ] UDL considerations appear in export

---

## 5.5 Phase 5: Material Generation (Future)

### 5.5.1 Vision

When AI suggests activities in a lesson (e.g., "puzzle challenge", "diagram activity", "practice worksheet"), the system should be able to **automatically generate the actual materials** - not just describe what they should be.

This transforms the AI from a planning assistant into a full content creation tool.

### 5.5.2 Goals

- Auto-generate teaching materials based on lesson component suggestions
- Reduce teacher prep time from hours to minutes
- Maintain quality and curriculum alignment
- Support various material types (text-based, puzzles, visual aids)

### 5.5.3 Material Types & Feasibility

| Material Type | Feasibility | Implementation Approach |
|---------------|-------------|------------------------|
| **Worksheets/Handouts** | High | LLM generates content, export to PDF/DOCX |
| **Practice Problems** | High | Similar to assessment question generation |
| **Reading Passages** | High | LLM generates grade-appropriate text |
| **Vocabulary Lists** | High | Extract from standards/content, LLM adds definitions |
| **Word Search Puzzles** | Medium | LLM provides words, algorithm generates grid |
| **Crossword Puzzles** | Medium | LLM provides clues/answers, algorithm generates puzzle |
| **Matching Activities** | Medium | LLM generates pairs, template formats |
| **Graphic Organizers** | Medium | LLM fills content, templates provide structure |
| **Diagrams/Visuals** | Low | Would require image generation AI (DALL-E, etc.) |
| **Interactive Activities** | Low | Would require separate tooling/platform |

### 5.5.4 Proposed Features

#### Text-Based Materials
```
Teacher: "Generate a bellringer puzzle for this lesson on photosynthesis"
AI generates:
- 10-question word scramble with photosynthesis terms
- Answer key
- Exportable PDF worksheet
```

#### Puzzle Generation
```
Teacher: "Create a crossword for vocabulary review"
AI generates:
- Pulls vocabulary from lesson content/standards
- Creates clues (definitions, fill-in-blank)
- Generates crossword grid
- Creates printable PDF with answer key
```

#### Practice Materials
```
Teacher: "Generate 10 practice problems for guided practice"
AI generates:
- Problems aligned to learning goals
- Scaffolded difficulty (easier → harder)
- Answer key with worked solutions
- Formatted worksheet PDF
```

### 5.5.5 Technical Considerations

1. **Template System**: Pre-built templates for worksheets, puzzles, activities
2. **Puzzle Algorithms**: Word search, crossword generation libraries
3. **PDF Generation**: Server-side PDF creation with proper formatting
4. **Content Alignment**: Generated materials must align with lesson goals/standards
5. **Customization**: Teachers should be able to modify before finalizing

### 5.5.6 Integration Points

- **Lesson Components**: "Generate Materials" button on each component
- **Export System**: Materials bundled with lesson export
- **Google Drive**: Auto-save generated materials to unit folder
- **Assessment System**: Practice problems can become quiz questions

### 5.5.7 Open Questions

| Question | Options | Notes |
|----------|---------|-------|
| Image generation? | DALL-E integration vs. stock images vs. none | Cost and quality tradeoffs |
| Interactive content? | Static PDF vs. Google Forms vs. web app | Complexity vs. value |
| Storage | Google Drive vs. local | Drive preferred for sharing |
| Editing | In-app vs. export-and-edit | Export first, in-app later |

### 5.5.8 Success Metrics

| Metric | Target |
|--------|--------|
| Materials generated per lesson | > 2 average |
| Teacher acceptance rate | > 60% used as-is or with minor edits |
| Time saved per lesson | > 30 minutes |
| Material quality rating | > 4/5 teacher satisfaction |

---

## 6. Technical Implementation Details

### 6.1 LLM Provider Considerations

| Provider | Strengths | Considerations |
|----------|-----------|----------------|
| **Claude (Anthropic)** | Excellent at structured output, good at education content | Best for complex generation |
| **GPT-4 (OpenAI)** | Strong general capability, function calling | Good fallback option |
| **Gemini (Google)** | Good for Google ecosystem integration | Consider for export features |

**Recommendation:** Optimize prompts for Claude, ensure they work with GPT-4 as fallback.

### 6.2 Prompt Engineering Best Practices

1. **Use structured output:** Request JSON with clear schema
2. **Provide examples:** Include 1-2 examples in system prompt
3. **Set constraints early:** State requirements before content
4. **Temperature guidance:** Use 0.3-0.5 for factual, 0.7-0.8 for creative
5. **Handle failures:** Parse errors should trigger retry with clarification

### 6.3 Token Management

```typescript
interface TokenBudget {
  maxInputTokens: number;
  maxOutputTokens: number;
  warningThreshold: number;  // Warn user if approaching limit
}

const TOKEN_BUDGETS = {
  questionGeneration: {
    maxInputTokens: 4000,
    maxOutputTokens: 2000,
    warningThreshold: 3000,
  },
  lessonGeneration: {
    maxInputTokens: 6000,
    maxOutputTokens: 4000,
    warningThreshold: 5000,
  },
};
```

### 6.4 Error Handling

| Error Type | Handling |
|------------|----------|
| Rate limit | Retry with exponential backoff, show "busy" message |
| Invalid response | Retry once with clarification prompt |
| Timeout | Show partial results if available, offer retry |
| Auth error | Prompt to check API key |
| Content filter | Show generic message, log for review |

### 6.5 Caching Strategy

- **Standards:** Cache parsed standards locally (1 hour TTL)
- **Generated questions:** Don't cache (each generation should be fresh)
- **Lesson templates:** Cache common structures (24 hour TTL)
- **Conversation history:** Session-only (not persisted to Drive)

---

## 7. Testing Strategy

### 7.1 Unit Tests

- Prompt template generation
- Response parsing
- Token counting
- Error handling

### 7.2 Integration Tests

- LLM service with mock provider
- IPC handlers with mock responses
- End-to-end generation flow

### 7.3 Manual Testing Checklist

#### Phase 1
- [ ] Generate 5 multiple choice questions
- [ ] Generate questions for multiple standards
- [ ] Simplify a generated question
- [ ] Improve distractors
- [ ] Chat naturally with assistant
- [ ] Handle generation errors gracefully

#### Phase 3
- [ ] Create lesson from scratch
- [ ] Generate learning goals
- [ ] Generate lesson structure
- [ ] Expand a component
- [ ] Reorder components
- [ ] Save and reload lesson

---

## 8. Rollout Plan

### 8.1 Phase 1 Timeline (Suggested)

1. **LLM prompt development & testing** - Refine prompts offline
2. **Service layer implementation** - Add IPC handlers
3. **UI components** - Build AI assistant panel
4. **Integration** - Connect UI to services
5. **Testing & refinement** - Fix issues, improve prompts

### 8.2 Feature Flags

```typescript
interface AIFeatureFlags {
  enableQuestionGeneration: boolean;
  enableQuestionRefinement: boolean;
  enableMaterialImport: boolean;
  enableLessonPlanning: boolean;
  enableAnalyticsIntegration: boolean;
}
```

Use feature flags to enable features incrementally.

---

## 9. Open Questions

| Question | Options | Recommendation |
|----------|---------|----------------|
| Store conversation history? | Session only vs. persist | Session only (simpler) |
| Default LLM provider? | Claude vs. GPT-4 | Claude (better structured output) |
| Lesson export format? | Google Docs vs. PDF vs. both | Google Docs primary, PDF secondary |
| Offline lesson editing? | Full offline vs. online required | Online for AI, offline for manual |

---

## 10. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Question generation success rate | > 95% | Parseable responses / total requests |
| Questions accepted by teachers | > 70% | Accepted / generated |
| Time to create assessment | < 50% of manual | User testing |
| Lesson creation adoption | > 50% of lessons use AI | Usage tracking |
| Teacher satisfaction | > 4/5 rating | Survey |

---

*Document Version: 1.0*
*Created: 2025-12-21*
*Status: Active - Phase 1 Ready for Implementation*
