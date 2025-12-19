import { create } from 'zustand'

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

interface ClassSummary {
  id: string
  name: string
  studentCount: number
  lastTestDate?: string
  averageScore?: number
}

interface AppState {
  // Sync status
  syncStatus: SyncStatus
  lastSyncTime: Date | null
  syncError: string | null

  // Current class context
  currentClassId: string | null
  classes: ClassSummary[]

  // Actions
  setSyncStatus: (status: SyncStatus) => void
  setSyncError: (error: string | null) => void
  markSynced: () => void
  setCurrentClass: (classId: string | null) => void
  setClasses: (classes: ClassSummary[]) => void
  addClass: (classInfo: ClassSummary) => void
  updateClass: (classId: string, updates: Partial<ClassSummary>) => void
  removeClass: (classId: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  syncStatus: 'idle',
  lastSyncTime: null,
  syncError: null,
  currentClassId: null,
  classes: [],

  // Actions
  setSyncStatus: (syncStatus) => set({ syncStatus }),

  setSyncError: (syncError) =>
    set({
      syncError,
      syncStatus: syncError ? 'error' : 'idle'
    }),

  markSynced: () =>
    set({
      syncStatus: 'synced',
      lastSyncTime: new Date(),
      syncError: null
    }),

  setCurrentClass: (currentClassId) => set({ currentClassId }),

  setClasses: (classes) => set({ classes }),

  addClass: (classInfo) =>
    set((state) => ({
      classes: [...state.classes, classInfo]
    })),

  updateClass: (classId, updates) =>
    set((state) => ({
      classes: state.classes.map((c) => (c.id === classId ? { ...c, ...updates } : c))
    })),

  removeClass: (classId) =>
    set((state) => ({
      classes: state.classes.filter((c) => c.id !== classId),
      currentClassId: state.currentClassId === classId ? null : state.currentClassId
    }))
}))
