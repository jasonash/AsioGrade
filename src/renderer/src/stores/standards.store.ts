import { create } from 'zustand'
import type {
  Standards,
  StandardsSummary,
  CreateStandardsInput,
  UpdateStandardsInput,
  StandardDomain,
  Standard
} from '../../../shared/types'
import type { ServiceResult } from '../../../shared/types/common.types'

// Input types for domain operations
interface DomainInput {
  code: string
  name: string
  description?: string
}

interface DomainUpdate {
  code?: string
  name?: string
  description?: string
}

// Input types for standard operations
interface StandardInput {
  code: string
  description: string
  keywords?: string[]
}

interface StandardUpdate {
  code?: string
  description?: string
  keywords?: string[]
}

interface StandardsState {
  // State
  summaries: StandardsSummary[] // List of all collections for current course
  currentCollection: Standards | null // Currently selected/viewed collection
  allCollections: Standards[] // All collections loaded (for unit creation)
  currentCourseId: string | null
  loading: boolean
  error: string | null

  // Actions
  setCurrentCourseId: (courseId: string | null) => void
  fetchCollections: (courseId: string) => Promise<void>
  fetchCollection: (courseId: string, standardsId: string) => Promise<void>
  fetchAllCollections: (courseId: string) => Promise<void>
  createCollection: (input: CreateStandardsInput) => Promise<Standards | null>
  updateCollection: (input: UpdateStandardsInput) => Promise<Standards | null>
  deleteCollection: (courseId: string, standardsId: string) => Promise<boolean>
  clearError: () => void
  clearStandards: () => void

  // Domain CRUD (operates on currentCollection)
  addDomain: (domain: DomainInput) => Promise<boolean>
  updateDomain: (domainCode: string, updates: DomainUpdate) => Promise<boolean>
  deleteDomain: (domainCode: string) => Promise<boolean>

  // Standard CRUD (operates on currentCollection)
  addStandard: (domainCode: string, standard: StandardInput) => Promise<boolean>
  updateStandard: (
    domainCode: string,
    standardCode: string,
    updates: StandardUpdate
  ) => Promise<boolean>
  deleteStandard: (domainCode: string, standardCode: string) => Promise<boolean>
}

export const useStandardsStore = create<StandardsState>((set, get) => ({
  // Initial state
  summaries: [],
  currentCollection: null,
  allCollections: [],
  currentCourseId: null,
  loading: false,
  error: null,

  // Actions
  setCurrentCourseId: (courseId) => set({ currentCourseId: courseId }),

  clearError: () => set({ error: null }),

  clearStandards: () =>
    set({
      summaries: [],
      currentCollection: null,
      allCollections: [],
      currentCourseId: null
    }),

  fetchCollections: async (courseId: string) => {
    set({ loading: true, error: null, currentCourseId: courseId })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<StandardsSummary[]>>(
        'drive:listStandardsCollections',
        courseId
      )

      if (result.success) {
        set({ summaries: result.data, loading: false })
      } else {
        set({ error: result.error, loading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch standards collections'
      set({ error: message, loading: false })
    }
  },

  fetchCollection: async (courseId: string, standardsId: string) => {
    set({ loading: true, error: null, currentCourseId: courseId })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Standards | null>>(
        'drive:getStandardsCollection',
        courseId,
        standardsId
      )

      if (result.success) {
        set({ currentCollection: result.data, loading: false })
      } else {
        set({ error: result.error, loading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch standards collection'
      set({ error: message, loading: false })
    }
  },

  fetchAllCollections: async (courseId: string) => {
    set({ loading: true, error: null, currentCourseId: courseId })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Standards[]>>(
        'drive:getAllStandardsForCourse',
        courseId
      )

      if (result.success) {
        set({ allCollections: result.data, loading: false })
      } else {
        set({ error: result.error, loading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch all standards'
      set({ error: message, loading: false })
    }
  },

  createCollection: async (input: CreateStandardsInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Standards>>(
        'drive:createStandardsCollection',
        input
      )

      if (result.success) {
        // Add to summaries list
        const newSummary: StandardsSummary = {
          id: result.data.id,
          courseId: result.data.courseId,
          name: result.data.name,
          state: result.data.state,
          subject: result.data.subject,
          gradeLevel: result.data.gradeLevel,
          framework: result.data.framework,
          standardCount: result.data.domains.reduce((c, d) => c + d.standards.length, 0),
          domainCount: result.data.domains.length,
          updatedAt: result.data.updatedAt
        }
        set((state) => ({
          summaries: [...state.summaries, newSummary],
          currentCollection: result.data,
          loading: false
        }))
        return result.data
      } else {
        set({ error: result.error, loading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create standards collection'
      set({ error: message, loading: false })
      return null
    }
  },

  updateCollection: async (input: UpdateStandardsInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Standards>>(
        'drive:updateStandardsCollection',
        input
      )

      if (result.success) {
        // Update summaries list
        const updatedSummary: StandardsSummary = {
          id: result.data.id,
          courseId: result.data.courseId,
          name: result.data.name,
          state: result.data.state,
          subject: result.data.subject,
          gradeLevel: result.data.gradeLevel,
          framework: result.data.framework,
          standardCount: result.data.domains.reduce((c, d) => c + d.standards.length, 0),
          domainCount: result.data.domains.length,
          updatedAt: result.data.updatedAt
        }
        set((state) => ({
          summaries: state.summaries.map((s) => (s.id === input.id ? updatedSummary : s)),
          currentCollection: result.data,
          loading: false
        }))
        return result.data
      } else {
        set({ error: result.error, loading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update standards collection'
      set({ error: message, loading: false })
      return null
    }
  },

  deleteCollection: async (courseId: string, standardsId: string) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<void>>(
        'drive:deleteStandardsCollection',
        courseId,
        standardsId
      )

      if (result.success) {
        set((state) => ({
          summaries: state.summaries.filter((s) => s.id !== standardsId),
          currentCollection:
            state.currentCollection?.id === standardsId ? null : state.currentCollection,
          loading: false
        }))
        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete standards collection'
      set({ error: message, loading: false })
      return false
    }
  },

  // Domain CRUD operations (operates on currentCollection)

  addDomain: async (domain: DomainInput) => {
    const state = get()
    const collection = state.currentCollection

    if (!collection) {
      set({ error: 'No standards collection selected' })
      return false
    }

    // Check for duplicate domain code
    if (collection.domains.some((d) => d.code === domain.code)) {
      set({ error: `Domain with code "${domain.code}" already exists` })
      return false
    }

    // Create new domain with empty standards array
    const newDomain: StandardDomain = {
      code: domain.code,
      name: domain.name,
      description: domain.description,
      standards: []
    }

    // Create updated domains
    const updatedDomains = [...collection.domains, newDomain]

    const input: UpdateStandardsInput = {
      id: collection.id,
      courseId: collection.courseId,
      domains: updatedDomains
    }

    const result = await state.updateCollection(input)
    return result !== null
  },

  updateDomain: async (domainCode: string, updates: DomainUpdate) => {
    const state = get()
    const collection = state.currentCollection

    if (!collection) {
      set({ error: 'No standards collection selected' })
      return false
    }

    const domainIndex = collection.domains.findIndex((d) => d.code === domainCode)
    if (domainIndex === -1) {
      set({ error: `Domain "${domainCode}" not found` })
      return false
    }

    // Check for duplicate code if code is being changed
    if (updates.code && updates.code !== domainCode) {
      if (collection.domains.some((d) => d.code === updates.code)) {
        set({ error: `Domain with code "${updates.code}" already exists` })
        return false
      }
    }

    // Update domain
    const updatedDomains = collection.domains.map((d, i) => {
      if (i === domainIndex) {
        return {
          ...d,
          code: updates.code ?? d.code,
          name: updates.name ?? d.name,
          description: updates.description ?? d.description
        }
      }
      return d
    })

    const input: UpdateStandardsInput = {
      id: collection.id,
      courseId: collection.courseId,
      domains: updatedDomains
    }

    const result = await state.updateCollection(input)
    return result !== null
  },

  deleteDomain: async (domainCode: string) => {
    const state = get()
    const collection = state.currentCollection

    if (!collection) {
      set({ error: 'No standards collection selected' })
      return false
    }

    const domainIndex = collection.domains.findIndex((d) => d.code === domainCode)
    if (domainIndex === -1) {
      set({ error: `Domain "${domainCode}" not found` })
      return false
    }

    // Remove domain
    const updatedDomains = collection.domains.filter((d) => d.code !== domainCode)

    const input: UpdateStandardsInput = {
      id: collection.id,
      courseId: collection.courseId,
      domains: updatedDomains
    }

    const result = await state.updateCollection(input)
    return result !== null
  },

  // Standard CRUD operations (operates on currentCollection)

  addStandard: async (domainCode: string, standard: StandardInput) => {
    const state = get()
    const collection = state.currentCollection

    if (!collection) {
      set({ error: 'No standards collection selected' })
      return false
    }

    const domainIndex = collection.domains.findIndex((d) => d.code === domainCode)
    if (domainIndex === -1) {
      set({ error: `Domain "${domainCode}" not found` })
      return false
    }

    // Check for duplicate standard code within the domain
    if (collection.domains[domainIndex].standards.some((s) => s.code === standard.code)) {
      set({ error: `Standard with code "${standard.code}" already exists in this domain` })
      return false
    }

    // Create new standard
    const newStandard: Standard = {
      code: standard.code,
      description: standard.description,
      keywords: standard.keywords || []
    }

    // Update domain's standards array
    const updatedDomains = collection.domains.map((d, i) => {
      if (i === domainIndex) {
        return {
          ...d,
          standards: [...d.standards, newStandard]
        }
      }
      return d
    })

    const input: UpdateStandardsInput = {
      id: collection.id,
      courseId: collection.courseId,
      domains: updatedDomains
    }

    const result = await state.updateCollection(input)
    return result !== null
  },

  updateStandard: async (domainCode: string, standardCode: string, updates: StandardUpdate) => {
    const state = get()
    const collection = state.currentCollection

    if (!collection) {
      set({ error: 'No standards collection selected' })
      return false
    }

    const domainIndex = collection.domains.findIndex((d) => d.code === domainCode)
    if (domainIndex === -1) {
      set({ error: `Domain "${domainCode}" not found` })
      return false
    }

    const standardIndex = collection.domains[domainIndex].standards.findIndex(
      (s) => s.code === standardCode
    )
    if (standardIndex === -1) {
      set({ error: `Standard "${standardCode}" not found in domain "${domainCode}"` })
      return false
    }

    // Check for duplicate code if code is being changed
    if (updates.code && updates.code !== standardCode) {
      if (collection.domains[domainIndex].standards.some((s) => s.code === updates.code)) {
        set({ error: `Standard with code "${updates.code}" already exists in this domain` })
        return false
      }
    }

    // Update standard
    const updatedDomains = collection.domains.map((d, di) => {
      if (di === domainIndex) {
        return {
          ...d,
          standards: d.standards.map((s, si) => {
            if (si === standardIndex) {
              return {
                ...s,
                code: updates.code ?? s.code,
                description: updates.description ?? s.description,
                keywords: updates.keywords ?? s.keywords
              }
            }
            return s
          })
        }
      }
      return d
    })

    const input: UpdateStandardsInput = {
      id: collection.id,
      courseId: collection.courseId,
      domains: updatedDomains
    }

    const result = await state.updateCollection(input)
    return result !== null
  },

  deleteStandard: async (domainCode: string, standardCode: string) => {
    const state = get()
    const collection = state.currentCollection

    if (!collection) {
      set({ error: 'No standards collection selected' })
      return false
    }

    const domainIndex = collection.domains.findIndex((d) => d.code === domainCode)
    if (domainIndex === -1) {
      set({ error: `Domain "${domainCode}" not found` })
      return false
    }

    const standardIndex = collection.domains[domainIndex].standards.findIndex(
      (s) => s.code === standardCode
    )
    if (standardIndex === -1) {
      set({ error: `Standard "${standardCode}" not found in domain "${domainCode}"` })
      return false
    }

    // Remove standard from domain
    const updatedDomains = collection.domains.map((d, di) => {
      if (di === domainIndex) {
        return {
          ...d,
          standards: d.standards.filter((s) => s.code !== standardCode)
        }
      }
      return d
    })

    const input: UpdateStandardsInput = {
      id: collection.id,
      courseId: collection.courseId,
      domains: updatedDomains
    }

    const result = await state.updateCollection(input)
    return result !== null
  }
}))
