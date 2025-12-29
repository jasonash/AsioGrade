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
// Roster types has runtime values (DOK constants) so use regular export
export * from './roster.types'
export type * from './standards.types'
export type * from './question.types'
export type * from './assessment.types'
export type * from './assignment.types'
export type * from './scantron.types'
export type * from './grade.types'
export type * from './ai.types'

// Course material types has runtime values (helper functions) so use regular export
export * from './courseMaterial.types'

// LLM types has runtime values (const arrays, functions) so use regular export
export * from './llm.types'
