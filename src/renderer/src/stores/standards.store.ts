import { create } from 'zustand'
import type {
  Standards,
  StandardsSummary,
  CreateStandardsInput,
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
  standards: Standards | null
  summary: StandardsSummary | null
  currentCourseId: string | null
  loading: boolean
  error: string | null

  // Actions
  setCurrentCourseId: (courseId: string | null) => void
  fetchStandards: (courseId: string) => Promise<void>
  fetchSummary: (courseId: string) => Promise<void>
  saveStandards: (input: CreateStandardsInput) => Promise<Standards | null>
  deleteStandards: (courseId: string) => Promise<boolean>
  clearError: () => void
  clearStandards: () => void

  // Domain CRUD
  addDomain: (courseId: string, domain: DomainInput) => Promise<boolean>
  updateDomain: (courseId: string, domainCode: string, updates: DomainUpdate) => Promise<boolean>
  deleteDomain: (courseId: string, domainCode: string) => Promise<boolean>

  // Standard CRUD
  addStandard: (courseId: string, domainCode: string, standard: StandardInput) => Promise<boolean>
  updateStandard: (
    courseId: string,
    domainCode: string,
    standardCode: string,
    updates: StandardUpdate
  ) => Promise<boolean>
  deleteStandard: (courseId: string, domainCode: string, standardCode: string) => Promise<boolean>
}

export const useStandardsStore = create<StandardsState>((set) => ({
  // Initial state
  standards: null,
  summary: null,
  currentCourseId: null,
  loading: false,
  error: null,

  // Actions
  setCurrentCourseId: (courseId) => set({ currentCourseId: courseId }),

  clearError: () => set({ error: null }),

  clearStandards: () => set({ standards: null, summary: null, currentCourseId: null }),

  fetchStandards: async (courseId: string) => {
    set({ loading: true, error: null, currentCourseId: courseId })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Standards | null>>(
        'drive:getStandards',
        courseId
      )

      if (result.success) {
        set({ standards: result.data, loading: false })
      } else {
        set({ error: result.error, loading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch standards'
      set({ error: message, loading: false })
    }
  },

  fetchSummary: async (courseId: string) => {
    set({ loading: true, error: null, currentCourseId: courseId })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<StandardsSummary | null>>(
        'drive:getStandardsSummary',
        courseId
      )

      if (result.success) {
        set({ summary: result.data, loading: false })
      } else {
        set({ error: result.error, loading: false })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch standards summary'
      set({ error: message, loading: false })
    }
  },

  saveStandards: async (input: CreateStandardsInput) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<Standards>>(
        'drive:saveStandards',
        input
      )

      if (result.success) {
        set({ standards: result.data, loading: false })
        return result.data
      } else {
        set({ error: result.error, loading: false })
        return null
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save standards'
      set({ error: message, loading: false })
      return null
    }
  },

  deleteStandards: async (courseId: string) => {
    set({ loading: true, error: null })

    try {
      const result = await window.electronAPI.invoke<ServiceResult<void>>(
        'drive:deleteStandards',
        courseId
      )

      if (result.success) {
        set({ standards: null, summary: null, loading: false })
        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete standards'
      set({ error: message, loading: false })
      return false
    }
  },

  // Domain CRUD operations

  addDomain: async (courseId: string, domain: DomainInput) => {
    const state = useStandardsStore.getState()
    const standards = state.standards

    if (!standards || standards.courseId !== courseId) {
      set({ error: 'Standards not loaded for this course' })
      return false
    }

    // Check for duplicate domain code
    if (standards.domains.some((d) => d.code === domain.code)) {
      set({ error: `Domain with code "${domain.code}" already exists` })
      return false
    }

    set({ loading: true, error: null })

    try {
      // Create new domain with empty standards array
      const newDomain: StandardDomain = {
        code: domain.code,
        name: domain.name,
        description: domain.description,
        standards: []
      }

      // Create updated standards with new domain
      const updatedDomains = [...standards.domains, newDomain]

      const input: CreateStandardsInput = {
        courseId: standards.courseId,
        source: standards.source,
        state: standards.state,
        subject: standards.subject,
        gradeLevel: standards.gradeLevel,
        framework: standards.framework,
        domains: updatedDomains
      }

      const result = await window.electronAPI.invoke<ServiceResult<Standards>>(
        'drive:saveStandards',
        input
      )

      if (result.success) {
        set({ standards: result.data, loading: false })
        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add domain'
      set({ error: message, loading: false })
      return false
    }
  },

  updateDomain: async (courseId: string, domainCode: string, updates: DomainUpdate) => {
    const state = useStandardsStore.getState()
    const standards = state.standards

    if (!standards || standards.courseId !== courseId) {
      set({ error: 'Standards not loaded for this course' })
      return false
    }

    const domainIndex = standards.domains.findIndex((d) => d.code === domainCode)
    if (domainIndex === -1) {
      set({ error: `Domain "${domainCode}" not found` })
      return false
    }

    // Check for duplicate code if code is being changed
    if (updates.code && updates.code !== domainCode) {
      if (standards.domains.some((d) => d.code === updates.code)) {
        set({ error: `Domain with code "${updates.code}" already exists` })
        return false
      }
    }

    set({ loading: true, error: null })

    try {
      // Update domain
      const updatedDomains = standards.domains.map((d, i) => {
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

      const input: CreateStandardsInput = {
        courseId: standards.courseId,
        source: standards.source,
        state: standards.state,
        subject: standards.subject,
        gradeLevel: standards.gradeLevel,
        framework: standards.framework,
        domains: updatedDomains
      }

      const result = await window.electronAPI.invoke<ServiceResult<Standards>>(
        'drive:saveStandards',
        input
      )

      if (result.success) {
        set({ standards: result.data, loading: false })
        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update domain'
      set({ error: message, loading: false })
      return false
    }
  },

  deleteDomain: async (courseId: string, domainCode: string) => {
    const state = useStandardsStore.getState()
    const standards = state.standards

    if (!standards || standards.courseId !== courseId) {
      set({ error: 'Standards not loaded for this course' })
      return false
    }

    const domainIndex = standards.domains.findIndex((d) => d.code === domainCode)
    if (domainIndex === -1) {
      set({ error: `Domain "${domainCode}" not found` })
      return false
    }

    set({ loading: true, error: null })

    try {
      // Remove domain
      const updatedDomains = standards.domains.filter((d) => d.code !== domainCode)

      const input: CreateStandardsInput = {
        courseId: standards.courseId,
        source: standards.source,
        state: standards.state,
        subject: standards.subject,
        gradeLevel: standards.gradeLevel,
        framework: standards.framework,
        domains: updatedDomains
      }

      const result = await window.electronAPI.invoke<ServiceResult<Standards>>(
        'drive:saveStandards',
        input
      )

      if (result.success) {
        set({ standards: result.data, loading: false })
        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete domain'
      set({ error: message, loading: false })
      return false
    }
  },

  // Standard CRUD operations

  addStandard: async (courseId: string, domainCode: string, standard: StandardInput) => {
    const state = useStandardsStore.getState()
    const standards = state.standards

    if (!standards || standards.courseId !== courseId) {
      set({ error: 'Standards not loaded for this course' })
      return false
    }

    const domainIndex = standards.domains.findIndex((d) => d.code === domainCode)
    if (domainIndex === -1) {
      set({ error: `Domain "${domainCode}" not found` })
      return false
    }

    // Check for duplicate standard code within the domain
    if (standards.domains[domainIndex].standards.some((s) => s.code === standard.code)) {
      set({ error: `Standard with code "${standard.code}" already exists in this domain` })
      return false
    }

    set({ loading: true, error: null })

    try {
      // Create new standard
      const newStandard: Standard = {
        code: standard.code,
        description: standard.description,
        keywords: standard.keywords || []
      }

      // Update domain's standards array
      const updatedDomains = standards.domains.map((d, i) => {
        if (i === domainIndex) {
          return {
            ...d,
            standards: [...d.standards, newStandard]
          }
        }
        return d
      })

      const input: CreateStandardsInput = {
        courseId: standards.courseId,
        source: standards.source,
        state: standards.state,
        subject: standards.subject,
        gradeLevel: standards.gradeLevel,
        framework: standards.framework,
        domains: updatedDomains
      }

      const result = await window.electronAPI.invoke<ServiceResult<Standards>>(
        'drive:saveStandards',
        input
      )

      if (result.success) {
        set({ standards: result.data, loading: false })
        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add standard'
      set({ error: message, loading: false })
      return false
    }
  },

  updateStandard: async (
    courseId: string,
    domainCode: string,
    standardCode: string,
    updates: StandardUpdate
  ) => {
    const state = useStandardsStore.getState()
    const standards = state.standards

    if (!standards || standards.courseId !== courseId) {
      set({ error: 'Standards not loaded for this course' })
      return false
    }

    const domainIndex = standards.domains.findIndex((d) => d.code === domainCode)
    if (domainIndex === -1) {
      set({ error: `Domain "${domainCode}" not found` })
      return false
    }

    const standardIndex = standards.domains[domainIndex].standards.findIndex(
      (s) => s.code === standardCode
    )
    if (standardIndex === -1) {
      set({ error: `Standard "${standardCode}" not found in domain "${domainCode}"` })
      return false
    }

    // Check for duplicate code if code is being changed
    if (updates.code && updates.code !== standardCode) {
      if (standards.domains[domainIndex].standards.some((s) => s.code === updates.code)) {
        set({ error: `Standard with code "${updates.code}" already exists in this domain` })
        return false
      }
    }

    set({ loading: true, error: null })

    try {
      // Update standard
      const updatedDomains = standards.domains.map((d, di) => {
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

      const input: CreateStandardsInput = {
        courseId: standards.courseId,
        source: standards.source,
        state: standards.state,
        subject: standards.subject,
        gradeLevel: standards.gradeLevel,
        framework: standards.framework,
        domains: updatedDomains
      }

      const result = await window.electronAPI.invoke<ServiceResult<Standards>>(
        'drive:saveStandards',
        input
      )

      if (result.success) {
        set({ standards: result.data, loading: false })
        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update standard'
      set({ error: message, loading: false })
      return false
    }
  },

  deleteStandard: async (courseId: string, domainCode: string, standardCode: string) => {
    const state = useStandardsStore.getState()
    const standards = state.standards

    if (!standards || standards.courseId !== courseId) {
      set({ error: 'Standards not loaded for this course' })
      return false
    }

    const domainIndex = standards.domains.findIndex((d) => d.code === domainCode)
    if (domainIndex === -1) {
      set({ error: `Domain "${domainCode}" not found` })
      return false
    }

    const standardIndex = standards.domains[domainIndex].standards.findIndex(
      (s) => s.code === standardCode
    )
    if (standardIndex === -1) {
      set({ error: `Standard "${standardCode}" not found in domain "${domainCode}"` })
      return false
    }

    set({ loading: true, error: null })

    try {
      // Remove standard from domain
      const updatedDomains = standards.domains.map((d, di) => {
        if (di === domainIndex) {
          return {
            ...d,
            standards: d.standards.filter((s) => s.code !== standardCode)
          }
        }
        return d
      })

      const input: CreateStandardsInput = {
        courseId: standards.courseId,
        source: standards.source,
        state: standards.state,
        subject: standards.subject,
        gradeLevel: standards.gradeLevel,
        framework: standards.framework,
        domains: updatedDomains
      }

      const result = await window.electronAPI.invoke<ServiceResult<Standards>>(
        'drive:saveStandards',
        input
      )

      if (result.success) {
        set({ standards: result.data, loading: false })
        return true
      } else {
        set({ error: result.error, loading: false })
        return false
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete standard'
      set({ error: message, loading: false })
      return false
    }
  }
}))
