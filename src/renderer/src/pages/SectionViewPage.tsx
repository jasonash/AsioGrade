import { type ReactElement, useEffect, useState } from 'react'
import { ArrowLeft, Plus, Upload, Loader2, Users, Calendar, MapPin } from 'lucide-react'
import { useRosterStore } from '../stores'
import { StudentList, StudentFormModal, CSVImportModal } from '../components/roster'
import { ConfirmModal } from '../components/ui'
import type { Student, CourseSummary, SectionSummary } from '../../../shared/types'

interface SectionViewPageProps {
  course: CourseSummary
  section: SectionSummary
  onBack: () => void
}

export function SectionViewPage({ course, section, onBack }: SectionViewPageProps): ReactElement {
  const { roster, loading, error, fetchRoster, deleteStudent, clearRoster } = useRosterStore()

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch roster when section changes
  useEffect(() => {
    fetchRoster(section.id)
    return () => {
      clearRoster()
    }
  }, [section.id, fetchRoster, clearRoster])

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deletingStudent) return

    setIsDeleting(true)
    const success = await deleteStudent(section.id, deletingStudent.id)
    setIsDeleting(false)

    if (success) {
      setDeletingStudent(null)
    }
  }

  const activeStudentCount = roster?.students.filter((s) => s.active).length ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">Back to {course.name}</span>
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{section.name}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1">
                <Users size={14} />
                {activeStudentCount} students
              </span>
              {section.schedule && (
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {section.schedule}
                </span>
              )}
              {section.room && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {section.room}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <Plus size={16} />
          Add Student
        </button>
        <button
          onClick={() => setIsImportModalOpen(true)}
          className="px-4 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm hover:border-[var(--color-accent)] transition-colors flex items-center gap-2"
        >
          <Upload size={16} />
          Import CSV
        </button>
      </div>

      {/* Loading state */}
      {loading && !roster && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[var(--color-accent)] animate-spin" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
          <p className="text-sm text-[var(--color-error)]">{error}</p>
          <button
            onClick={() => fetchRoster(section.id)}
            className="mt-2 text-sm text-[var(--color-accent)] hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Student list */}
      {roster && (
        <StudentList
          students={roster.students}
          onEdit={(student) => setEditingStudent(student)}
          onDelete={(student) => setDeletingStudent(student)}
        />
      )}

      {/* Add Student Modal */}
      <StudentFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        sectionId={section.id}
      />

      {/* Edit Student Modal */}
      <StudentFormModal
        isOpen={!!editingStudent}
        onClose={() => setEditingStudent(null)}
        sectionId={section.id}
        student={editingStudent ?? undefined}
        onSuccess={() => setEditingStudent(null)}
      />

      {/* CSV Import Modal */}
      <CSVImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        sectionId={section.id}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingStudent}
        onClose={() => setDeletingStudent(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Student"
        message={`Are you sure you want to delete ${deletingStudent?.firstName} ${deletingStudent?.lastName}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  )
}
