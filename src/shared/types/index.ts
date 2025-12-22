/**
 * Shared type definitions
 * Re-exports all types for easy importing
 *
 * Note: Using 'export type *' for type-only modules to ensure
 * Rollup/Vite correctly handles type re-exports during bundling.
 */

// Types only - use 'export type *'
export type * from './common.types'
export type * from './course.types'
export type * from './section.types'
export type * from './roster.types'
export type * from './standards.types'
export type * from './unit.types'
export type * from './question.types'
export type * from './assessment.types'
export type * from './assignment.types'
export type * from './scantron.types'
export type * from './grade.types'
export type * from './ai.types'
export type * from './lesson.types'

// LLM types has runtime values (const arrays, functions) so use regular export
export * from './llm.types'

// Lesson types has runtime values (const objects) so use regular export
export * from './lesson.types'

// Material types has runtime values (const objects) so use regular export
export * from './material.types'
