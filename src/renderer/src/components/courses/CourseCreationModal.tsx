import { type ReactElement, useState, useCallback, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal } from '../ui'
import { useCourseStore } from '../../stores'
import type { Course, CreateCourseInput } from '../../../../shared/types'

interface CourseCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (course: Course) => void
}

const GRADE_LEVELS = [
  { value: 'K', label: 'Kindergarten' },
  { value: 'K-2', label: 'K-2 (Early Elementary)' },
  { value: '3-5', label: '3-5 (Upper Elementary)' },
  { value: '6', label: '6th Grade' },
  { value: '7', label: '7th Grade' },
  { value: '8', label: '8th Grade' },
  { value: '6-8', label: '6-8 (Middle School)' },
  { value: '9', label: '9th Grade' },
  { value: '10', label: '10th Grade' },
  { value: '11', label: '11th Grade' },
  { value: '12', label: '12th Grade' },
  { value: '9-12', label: '9-12 (High School)' }
]

function getAcademicYearOptions(): { value: string; label: string }[] {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  // Current academic year
  const currentYear = month >= 6 ? year : year - 1
  const nextYear = currentYear + 1

  return [
    { value: `${currentYear}-${nextYear}`, label: `${currentYear}-${nextYear}` },
    { value: `${nextYear}-${nextYear + 1}`, label: `${nextYear}-${nextYear + 1}` }
  ]
}

interface FormData {
  name: string
  subject: string
  gradeLevel: string
  academicYear: string
  description: string
}

interface FormErrors {
  name?: string
  subject?: string
  gradeLevel?: string
}

export function CourseCreationModal({
  isOpen,
  onClose,
  onSuccess
}: CourseCreationModalProps): ReactElement {
  const { academicYear, createCourse, error: storeError, clearError } = useCourseStore()

  const academicYearOptions = getAcademicYearOptions()

  const [formData, setFormData] = useState<FormData>({
    name: '',
    subject: '',
    gradeLevel: '',
    academicYear: academicYear,
    description: ''
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        subject: '',
        gradeLevel: '',
        academicYear: academicYear,
        description: ''
      })
      setErrors({})
      clearError()
    }
  }, [isOpen, academicYear, clearError])

  const handleChange = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }, [errors])

  const validate = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Course name is required'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Course name must be at least 2 characters'
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Course name must be less than 100 characters'
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required'
    } else if (formData.subject.trim().length < 2) {
      newErrors.subject = 'Subject must be at least 2 characters'
    }

    if (!formData.gradeLevel) {
      newErrors.gradeLevel = 'Grade level is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      if (!validate()) return

      setIsSubmitting(true)

      const input: CreateCourseInput = {
        name: formData.name.trim(),
        subject: formData.subject.trim(),
        gradeLevel: formData.gradeLevel,
        academicYear: formData.academicYear,
        description: formData.description.trim() || undefined
      }

      const course = await createCourse(input)

      setIsSubmitting(false)

      if (course) {
        onSuccess?.(course)
        onClose()
      }
    },
    [formData, validate, createCourse, onSuccess, onClose]
  )

  const inputClassName =
    'w-full px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] text-sm focus:outline-none focus:border-[var(--color-accent)] transition-colors'

  const labelClassName = 'block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5'

  const errorClassName = 'mt-1 text-xs text-[var(--color-error)]'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Course" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Store error */}
        {storeError && (
          <div className="p-3 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20">
            <p className="text-sm text-[var(--color-error)]">{storeError}</p>
          </div>
        )}

        {/* Course Name */}
        <div>
          <label htmlFor="course-name" className={labelClassName}>
            Course Name <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            id="course-name"
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g., Earth Science, AP Chemistry"
            className={`${inputClassName} ${errors.name ? 'border-[var(--color-error)]' : ''}`}
            disabled={isSubmitting}
          />
          {errors.name && <p className={errorClassName}>{errors.name}</p>}
        </div>

        {/* Subject */}
        <div>
          <label htmlFor="course-subject" className={labelClassName}>
            Subject <span className="text-[var(--color-error)]">*</span>
          </label>
          <input
            id="course-subject"
            type="text"
            value={formData.subject}
            onChange={(e) => handleChange('subject', e.target.value)}
            placeholder="e.g., Science, Math, English"
            className={`${inputClassName} ${errors.subject ? 'border-[var(--color-error)]' : ''}`}
            disabled={isSubmitting}
          />
          {errors.subject && <p className={errorClassName}>{errors.subject}</p>}
        </div>

        {/* Grade Level */}
        <div>
          <label htmlFor="course-grade" className={labelClassName}>
            Grade Level <span className="text-[var(--color-error)]">*</span>
          </label>
          <select
            id="course-grade"
            value={formData.gradeLevel}
            onChange={(e) => handleChange('gradeLevel', e.target.value)}
            className={`${inputClassName} ${errors.gradeLevel ? 'border-[var(--color-error)]' : ''}`}
            disabled={isSubmitting}
          >
            <option value="">Select grade level...</option>
            {GRADE_LEVELS.map((grade) => (
              <option key={grade.value} value={grade.value}>
                {grade.label}
              </option>
            ))}
          </select>
          {errors.gradeLevel && <p className={errorClassName}>{errors.gradeLevel}</p>}
        </div>

        {/* Academic Year */}
        <div>
          <label htmlFor="course-year" className={labelClassName}>
            Academic Year
          </label>
          <select
            id="course-year"
            value={formData.academicYear}
            onChange={(e) => handleChange('academicYear', e.target.value)}
            className={inputClassName}
            disabled={isSubmitting}
          >
            {academicYearOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="course-description" className={labelClassName}>
            Description <span className="text-[var(--color-text-muted)]">(optional)</span>
          </label>
          <textarea
            id="course-description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Brief description of this course..."
            rows={3}
            className={`${inputClassName} resize-none`}
            disabled={isSubmitting}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] text-sm hover:bg-[var(--color-surface-active)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? 'Creating...' : 'Create Course'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
