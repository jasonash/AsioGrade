/**
 * Material Generation Types (Phase 5)
 *
 * Types for AI-assisted teaching material generation including
 * worksheets, puzzles, vocabulary lists, graphic organizers, and diagrams.
 */

import type { LLMUsage } from './llm.types'
import type { LessonComponentType, LearningGoal } from './lesson.types'

// ============================================================
// Material Types
// ============================================================

/**
 * Types of materials that can be generated
 */
export type GeneratedMaterialType =
  | 'worksheet' // Practice problems / questions
  | 'word-search' // Word search puzzle
  | 'crossword' // Crossword puzzle
  | 'vocabulary-list' // Term/definition list
  | 'practice-problems' // Math/science problems with solutions
  | 'graphic-organizer' // Visual organization templates
  | 'diagram' // AI-generated educational diagram
  | 'exit-ticket' // Quick formative assessment

/**
 * Display labels for material types
 */
export const MATERIAL_TYPE_LABELS: Record<GeneratedMaterialType, string> = {
  worksheet: 'Worksheet',
  'word-search': 'Word Search',
  crossword: 'Crossword Puzzle',
  'vocabulary-list': 'Vocabulary List',
  'practice-problems': 'Practice Problems',
  'graphic-organizer': 'Graphic Organizer',
  diagram: 'Diagram',
  'exit-ticket': 'Exit Ticket'
}

/**
 * Material type descriptions for UI
 */
export const MATERIAL_TYPE_DESCRIPTIONS: Record<GeneratedMaterialType, string> = {
  worksheet: 'Questions and exercises for student practice',
  'word-search': 'Vocabulary word search puzzle',
  crossword: 'Crossword puzzle with vocabulary clues',
  'vocabulary-list': 'Terms and definitions for study',
  'practice-problems': 'Math or science problems with answer key',
  'graphic-organizer': 'Visual templates for organizing information',
  diagram: 'Educational diagram or illustration',
  'exit-ticket': 'Quick check for understanding'
}

/**
 * Whether a material type requires Gemini image generation
 */
export const MATERIAL_REQUIRES_IMAGE_API: Record<GeneratedMaterialType, boolean> = {
  worksheet: false,
  'word-search': false,
  crossword: false,
  'vocabulary-list': false,
  'practice-problems': false,
  'graphic-organizer': false,
  diagram: true,
  'exit-ticket': false
}

// ============================================================
// Graphic Organizer Templates
// ============================================================

/**
 * Pre-defined graphic organizer template types
 */
export type GraphicOrganizerTemplate =
  | 'venn-diagram' // Compare/contrast 2-3 items
  | 'concept-map' // Central concept with branches
  | 'flowchart' // Sequential process
  | 'kwl-chart' // Know-Want to Know-Learned
  | 'cause-effect' // Cause and effect relationships
  | 'timeline' // Chronological sequence
  | 'main-idea' // Main idea with supporting details
  | 'comparison-matrix' // Multiple items, multiple criteria

export const GRAPHIC_ORGANIZER_LABELS: Record<GraphicOrganizerTemplate, string> = {
  'venn-diagram': 'Venn Diagram',
  'concept-map': 'Concept Map',
  flowchart: 'Flowchart',
  'kwl-chart': 'KWL Chart',
  'cause-effect': 'Cause & Effect',
  timeline: 'Timeline',
  'main-idea': 'Main Idea & Details',
  'comparison-matrix': 'Comparison Matrix'
}

// ============================================================
// Material Generation Request/Response
// ============================================================

/**
 * Options specific to each material type
 */
export interface MaterialOptions {
  // Worksheet / Practice Problems
  questionCount?: number // Number of questions (default: 10)
  includeAnswerKey?: boolean // Include answer key (default: true)
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed'

  // Word Search / Crossword
  puzzleSize?: 'small' | 'medium' | 'large' // Grid size
  wordCount?: number // Number of words (default: 10-15)

  // Vocabulary List
  includeExamples?: boolean // Include example sentences

  // Graphic Organizer
  template?: GraphicOrganizerTemplate
  itemCount?: number // Number of items to compare/organize

  // Diagram
  diagramStyle?: 'labeled' | 'simple' | 'detailed'
  includeLabels?: boolean

  // Exit Ticket
  exitTicketQuestions?: number // Number of questions (default: 3)
}

/**
 * Request to generate teaching material
 */
export interface MaterialGenerationRequest {
  // Context
  lessonId: string
  courseId: string
  unitId: string
  componentId?: string // If generating for a specific component

  // Material configuration
  materialType: GeneratedMaterialType
  topic: string // Main topic/focus
  gradeLevel: string
  subject: string
  standards: string[] // Standard refs for alignment

  // Learning context
  learningGoals?: LearningGoal[]
  componentType?: LessonComponentType // The component this is for

  // Type-specific options
  options?: MaterialOptions

  // Additional context
  additionalInstructions?: string
}

/**
 * A single practice question for worksheets
 */
export interface PracticeQuestion {
  id: string
  number: number
  text: string
  type: 'multiple-choice' | 'short-answer' | 'fill-blank' | 'true-false'
  choices?: { id: string; text: string }[]
  correctAnswer: string
  explanation?: string
  points?: number
}

/**
 * A vocabulary item
 */
export interface VocabularyItem {
  id: string
  term: string
  definition: string
  example?: string
  partOfSpeech?: string
}

/**
 * Word search puzzle data
 */
export interface WordSearchData {
  grid: string[][] // 2D grid of letters
  words: string[] // Words to find
  size: number // Grid dimension
  solution?: { word: string; startRow: number; startCol: number; direction: string }[]
}

/**
 * Crossword puzzle data
 */
export interface CrosswordData {
  grid: (string | null)[][] // 2D grid, null for black squares
  acrossClues: { number: number; clue: string; answer: string; row: number; col: number }[]
  downClues: { number: number; clue: string; answer: string; row: number; col: number }[]
  size: { rows: number; cols: number }
}

/**
 * Graphic organizer content
 */
export interface GraphicOrganizerData {
  template: GraphicOrganizerTemplate
  title: string
  items: { id: string; label: string; content: string[] }[]
  connections?: { from: string; to: string; label?: string }[]
}

/**
 * Exit ticket content
 */
export interface ExitTicketData {
  title: string
  questions: {
    id: string
    number: number
    text: string
    type: 'reflection' | 'check' | 'application'
    lines?: number // Number of lines for response
  }[]
}

/**
 * Content container for generated material
 */
export interface MaterialContent {
  // Text-based content
  title: string
  instructions?: string

  // Type-specific content (only one populated based on type)
  questions?: PracticeQuestion[] // worksheet, practice-problems
  vocabulary?: VocabularyItem[] // vocabulary-list
  wordSearch?: WordSearchData // word-search
  crossword?: CrosswordData // crossword
  graphicOrganizer?: GraphicOrganizerData // graphic-organizer
  exitTicket?: ExitTicketData // exit-ticket

  // Diagram content
  diagramPrompt?: string // Prompt used for generation
  diagramImage?: string // Base64 encoded image

  // Answer key (separate for teacher reference)
  answerKey?: string[]
}

/**
 * A fully generated material
 */
export interface GeneratedMaterial {
  id: string
  lessonId: string
  componentId?: string

  // Material metadata
  type: GeneratedMaterialType
  name: string
  topic: string

  // Content
  content: MaterialContent

  // Generation info
  aiGenerated: true
  aiModel: string
  generatedAt: string

  // PDF output
  pdfBuffer?: string // Base64 encoded PDF

  // Token usage
  usage?: LLMUsage
}

/**
 * Result of material generation
 */
export interface MaterialGenerationResult {
  material: GeneratedMaterial
  usage: LLMUsage
}

// ============================================================
// Puzzle Vocabulary Extraction
// ============================================================

/**
 * Request to extract vocabulary for puzzles
 */
export interface PuzzleVocabularyRequest {
  topic: string
  gradeLevel: string
  subject: string
  wordCount: number
  standards?: string[]
  existingContent?: string // Lesson content to extract from
}

/**
 * Vocabulary with clues for crossword generation
 */
export interface PuzzleVocabulary {
  word: string
  clue: string
  difficulty?: 'easy' | 'medium' | 'hard'
}

/**
 * Result of vocabulary extraction
 */
export interface PuzzleVocabularyResult {
  vocabulary: PuzzleVocabulary[]
  usage: LLMUsage
}

// ============================================================
// Image Generation Types (Gemini)
// ============================================================

/**
 * Request to generate an educational diagram
 */
export interface DiagramGenerationRequest {
  topic: string
  gradeLevel: string
  subject: string
  style: 'labeled' | 'simple' | 'detailed'
  aspectRatio?: '1:1' | '16:9' | '4:3'
  additionalInstructions?: string
}

/**
 * Result of diagram generation
 */
export interface DiagramGenerationResult {
  imageBase64: string
  mimeType: string
  promptUsed: string
  usage?: LLMUsage
}

// ============================================================
// Material Store State
// ============================================================

/**
 * State for material generation in UI
 */
export interface MaterialGenerationState {
  isGenerating: boolean
  generatingType: GeneratedMaterialType | null
  progress: string | null
  error: string | null
  pendingMaterial: GeneratedMaterial | null // Material waiting for save
}

/**
 * Summary of generated material for lists
 */
export interface GeneratedMaterialSummary {
  id: string
  lessonId: string
  type: GeneratedMaterialType
  name: string
  generatedAt: string
}
