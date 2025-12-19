import { type ReactElement, useEffect, useState } from 'react'
import { ArrowLeft, Plus, Loader2, Users, Calendar, MapPin } from 'lucide-react'
import { useCourseStore, useSectionStore } from '../stores'
import { SectionCreationModal } from '../components/sections'
import type { SectionSummary } from '../../../shared/types'

interface CourseViewPageProps {
  onSectionSelect?: (section: SectionSummary) => void
}

export function CourseViewPage({ onSectionSelect }: CourseViewPageProps): ReactElement {
  const { currentCourse, setCurrentCourse } = useCourseStore()
  const { sections, loading, error, fetchSections, clearSections } = useSectionStore()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Fetch sections when course changes
  useEffect(() => {
    if (currentCourse?.id) {
      fetchSections(currentCourse.id)
    }
    return () => {
      clearSections()
    }
  }, [currentCourse?.id, fetchSections, clearSections])

  const handleBackClick = (): void => {
    setCurrentCourse(null)
  }

  if (!currentCourse) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-[var(--color-text-muted)]">No course selected</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <button
          onClick={handleBackClick}
          className="flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          <span className="text-sm">Back to Dashboard</span>
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {currentCourse.name}
            </h1>
            <p className="text-[var(--color-text-secondary)] mt-1">
              {currentCourse.subject} | Grade {currentCourse.gradeLevel} | {currentCourse.academicYear}
            </p>
          </div>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">
            {sections.length}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Sections</div>
        </div>
        <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">
            {sections.reduce((sum, s) => sum + s.studentCount, 0)}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Total Students</div>
        </div>
        <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">0</div>
          <div className="text-sm text-[var(--color-text-muted)]">Units</div>
        </div>
      </div>

      {/* Sections */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Sections</h2>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <Plus size={16} />
            Add Section
          </button>
        </div>

        {/* Loading state */}
        {loading && sections.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[var(--color-accent)] animate-spin" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="p-4 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 mb-4">
            <p className="text-sm text-[var(--color-error)]">{error}</p>
            <button
              onClick={() => fetchSections(currentCourse.id)}
              className="mt-2 text-sm text-[var(--color-accent)] hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && sections.length === 0 && (
          <div className="p-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center">
              <Users className="w-6 h-6 text-[var(--color-accent)]" />
            </div>
            <h3 className="text-[var(--color-text-primary)] font-medium mb-1">No sections yet</h3>
            <p className="text-[var(--color-text-muted)] text-sm mb-4">
              Add sections to organize your students by period or block.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Add Your First Section
            </button>
          </div>
        )}

        {/* Sections list */}
        {sections.length > 0 && (
          <div className="space-y-2">
            {sections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                onView={() => onSectionSelect?.(section)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Section Creation Modal */}
      <SectionCreationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        courseId={currentCourse.id}
        courseName={currentCourse.name}
        onSuccess={(section) => {
          console.log('Section created:', section.name)
        }}
      />
    </div>
  )
}

interface SectionCardProps {
  section: SectionSummary
  onView: () => void
}

function SectionCard({ section, onView }: SectionCardProps): ReactElement {
  return (
    <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 transition-colors">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-[var(--color-text-primary)]">{section.name}</h3>
          <div className="flex items-center gap-4 mt-1 text-sm text-[var(--color-text-muted)]">
            <span className="flex items-center gap-1">
              <Users size={14} />
              {section.studentCount} students
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
        <button
          onClick={onView}
          className="px-3 py-1.5 rounded-lg text-sm text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
        >
          View
        </button>
      </div>
    </div>
  )
}
